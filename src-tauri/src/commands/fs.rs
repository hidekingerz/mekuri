use crate::archive;
use base64::Engine;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_archive: bool,
    pub is_pdf: bool,
    pub has_subfolders: bool,
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let dir_path = PathBuf::from(&path);

    let entries =
        std::fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {e}"))?;

    let mut result: Vec<DirectoryEntry> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files
            if name.starts_with('.') {
                return None;
            }

            let entry_path = entry.path();
            let path = entry_path.to_string_lossy().to_string();
            let is_dir = metadata.is_dir();
            let is_archive = !is_dir && archive::is_archive_file(&name);
            let is_pdf = !is_dir && !is_archive && archive::is_pdf_file(&name);

            // Only show directories, archives, and PDFs
            if !is_dir && !is_archive && !is_pdf {
                return None;
            }

            // Check if directory has subfolders
            let has_subfolders = if is_dir {
                has_subdirectories(&entry_path)
            } else {
                false
            };

            Some(DirectoryEntry {
                name,
                path,
                is_dir,
                is_archive,
                is_pdf,
                has_subfolders,
            })
        })
        .collect();

    result.sort_by(|a, b| {
        // Directories first, then archives
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => natord::compare(&a.name, &b.name),
        }
    });

    Ok(result)
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);
    let data = std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

#[tauri::command]
pub fn trash_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {path}"));
    }
    if !file_path.is_file() {
        return Err(format!("Path is not a file: {path}"));
    }
    trash::delete(&file_path).map_err(|e| format!("Failed to move file to trash: {e}"))
}

#[tauri::command]
pub fn search_directory(path: String, query: String) -> Result<Vec<DirectoryEntry>, String> {
    let dir_path = PathBuf::from(&path);
    let query_lower = query.to_lowercase();
    let mut result: Vec<DirectoryEntry> = Vec::new();

    search_recursive(&dir_path, &query_lower, &mut result)
        .map_err(|e| format!("Failed to search directory: {e}"))?;

    result.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => natord::compare(&a.name, &b.name),
    });

    Ok(result)
}

fn search_recursive(
    dir: &PathBuf,
    query: &str,
    result: &mut Vec<DirectoryEntry>,
) -> std::io::Result<()> {
    let entries = std::fs::read_dir(dir)?;

    for entry in entries.flatten() {
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        let is_dir = metadata.is_dir();

        if is_dir {
            if name.to_lowercase().contains(query) {
                let path_str = entry_path.to_string_lossy().to_string();
                let has_subfolders = has_subdirectories(&entry_path);
                result.push(DirectoryEntry {
                    name,
                    path: path_str,
                    is_dir: true,
                    is_archive: false,
                    is_pdf: false,
                    has_subfolders,
                });
            }
            // 再帰的にサブディレクトリを検索
            let _ = search_recursive(&entry_path, query, result);
        } else {
            let is_archive = archive::is_archive_file(&name);
            let is_pdf = !is_archive && archive::is_pdf_file(&name);

            if (is_archive || is_pdf) && name.to_lowercase().contains(query) {
                let path_str = entry_path.to_string_lossy().to_string();
                result.push(DirectoryEntry {
                    name,
                    path: path_str,
                    is_dir: false,
                    is_archive,
                    is_pdf,
                    has_subfolders: false,
                });
            }
        }
    }

    Ok(())
}

fn has_subdirectories(path: &PathBuf) -> bool {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    // Skip hidden directories
                    if !name.starts_with('.') {
                        return true;
                    }
                }
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn trash_file_nonexistent_path() {
        let result = trash_file("/tmp/nonexistent_file_mekuri_test_12345.zip".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File does not exist"));
    }

    #[test]
    fn trash_file_directory_path() {
        let dir = tempfile::tempdir().unwrap();
        let dir_path = dir.path().to_string_lossy().to_string();
        let result = trash_file(dir_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path is not a file"));
    }

    #[test]
    fn search_directory_finds_matching_files() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::write(dir.path().join("test.zip"), "").unwrap();
        fs::write(sub.join("nested.zip"), "").unwrap();
        fs::write(sub.join("other.txt"), "").unwrap();

        let result =
            search_directory(dir.path().to_string_lossy().to_string(), "zip".to_string()).unwrap();
        let names: Vec<&str> = result.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"test.zip"));
        assert!(names.contains(&"nested.zip"));
        assert!(!names.contains(&"other.txt"));
    }

    #[test]
    fn search_directory_finds_matching_folders() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("manga_vol1");
        fs::create_dir(&sub).unwrap();
        let other = dir.path().join("photos");
        fs::create_dir(&other).unwrap();

        let result = search_directory(
            dir.path().to_string_lossy().to_string(),
            "manga".to_string(),
        )
        .unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "manga_vol1");
        assert!(result[0].is_dir);
    }

    #[test]
    fn search_directory_case_insensitive() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("MyArchive.ZIP"), "").unwrap();

        let result = search_directory(
            dir.path().to_string_lossy().to_string(),
            "myarchive".to_string(),
        )
        .unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "MyArchive.ZIP");
    }

    #[test]
    fn search_directory_no_results() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("test.zip"), "").unwrap();

        let result = search_directory(
            dir.path().to_string_lossy().to_string(),
            "nonexistent".to_string(),
        )
        .unwrap();
        assert!(result.is_empty());
    }

    #[test]
    #[ignore] // Requires Finder interaction on macOS; run manually with `cargo test -- --ignored`
    fn trash_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test_trash.txt");
        fs::write(&file_path, "test content").unwrap();
        assert!(file_path.exists());

        let result = trash_file(file_path.to_string_lossy().to_string());
        assert!(result.is_ok(), "trash_file failed: {:?}", result);
        assert!(!file_path.exists());
    }
}
