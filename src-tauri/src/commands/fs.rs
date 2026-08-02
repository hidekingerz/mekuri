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
pub fn move_file(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = PathBuf::from(&src);
    if !src_path.exists() {
        return Err(format!("File does not exist: {src}"));
    }
    if !src_path.is_file() {
        return Err(format!("Path is not a file: {src}"));
    }
    let dest_dir_path = PathBuf::from(&dest_dir);
    if !dest_dir_path.is_dir() {
        return Err(format!("Destination is not a directory: {dest_dir}"));
    }

    // 同一フォルダへの移動は no-op ではなくエラーとして返す
    let src_parent = src_path
        .parent()
        .ok_or_else(|| format!("Invalid file path: {src}"))?;
    let same_dir = match (src_parent.canonicalize(), dest_dir_path.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    if same_dir {
        return Err("Source and destination are the same folder".to_string());
    }

    let file_name = src_path
        .file_name()
        .ok_or_else(|| format!("Invalid file path: {src}"))?;
    let dest_path = dest_dir_path.join(file_name);
    if dest_path.exists() {
        return Err(format!(
            "A file with the same name already exists: {}",
            dest_path.display()
        ));
    }

    // rename を試し、失敗（クロスデバイス等）なら copy + remove にフォールバック。
    // コピー後の削除失敗は二重存在を許容し、データ喪失は起こさない。
    if std::fs::rename(&src_path, &dest_path).is_err() {
        std::fs::copy(&src_path, &dest_path).map_err(|e| format!("Failed to copy file: {e}"))?;
        std::fs::remove_file(&src_path)
            .map_err(|e| format!("Copied to destination but failed to remove the original: {e}"))?;
    }

    dest_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Destination path is not valid UTF-8".to_string())
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

    #[test]
    fn move_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        std::fs::write(&src, b"data").unwrap();
        let dest_dir = dir.path().join("sub");
        std::fs::create_dir(&dest_dir).unwrap();

        let result = move_file(
            src.to_string_lossy().to_string(),
            dest_dir.to_string_lossy().to_string(),
        );

        let new_path = result.unwrap();
        assert_eq!(new_path, dest_dir.join("a.zip").to_string_lossy());
        assert!(!src.exists());
        assert!(dest_dir.join("a.zip").exists());
        assert_eq!(std::fs::read(dest_dir.join("a.zip")).unwrap(), b"data");
    }

    #[test]
    fn move_file_collision_is_error_and_keeps_source() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        std::fs::write(&src, b"data").unwrap();
        let dest_dir = dir.path().join("sub");
        std::fs::create_dir(&dest_dir).unwrap();
        std::fs::write(dest_dir.join("a.zip"), b"other").unwrap();

        let result = move_file(
            src.to_string_lossy().to_string(),
            dest_dir.to_string_lossy().to_string(),
        );

        assert!(result.unwrap_err().contains("already exists"));
        assert!(src.exists());
        assert_eq!(std::fs::read(dest_dir.join("a.zip")).unwrap(), b"other");
    }

    #[test]
    fn move_file_nonexistent_src() {
        let dir = tempfile::tempdir().unwrap();
        let result = move_file(
            "/tmp/nonexistent_mekuri_move_12345.zip".to_string(),
            dir.path().to_string_lossy().to_string(),
        );
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn move_file_src_is_directory() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        std::fs::create_dir(&sub).unwrap();
        let result = move_file(
            sub.to_string_lossy().to_string(),
            dir.path().to_string_lossy().to_string(),
        );
        assert!(result.unwrap_err().contains("not a file"));
    }

    #[test]
    fn move_file_dest_not_directory() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        std::fs::write(&src, b"data").unwrap();
        let result = move_file(
            src.to_string_lossy().to_string(),
            dir.path().join("no_such_dir").to_string_lossy().to_string(),
        );
        assert!(result.unwrap_err().contains("not a directory"));
        assert!(src.exists());
    }

    #[test]
    fn move_file_same_directory_is_error() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        std::fs::write(&src, b"data").unwrap();
        let result = move_file(
            src.to_string_lossy().to_string(),
            dir.path().to_string_lossy().to_string(),
        );
        assert!(result.unwrap_err().contains("same"));
        assert!(src.exists());
    }
}
