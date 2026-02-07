use serde::Serialize;
use std::path::PathBuf;

const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "cbz", "rar", "cbr", "7z"];

#[derive(Debug, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_archive: bool,
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
            let is_archive = !is_dir && is_archive_file(&name);

            // Only show directories and archives
            if !is_dir && !is_archive {
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

fn is_archive_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    ARCHIVE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
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
