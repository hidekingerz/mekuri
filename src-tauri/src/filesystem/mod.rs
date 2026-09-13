//! ファイルシステム操作の純粋ロジック。Tauri に依存せず、単体テスト可能。
//! Tauri コマンドからの呼び出しは `commands::fs` が担当する。

use crate::archive;
use base64::Engine;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_archive: bool,
    pub is_pdf: bool,
    pub has_subfolders: bool,
}

/// ディレクトリ直下のフォルダ・アーカイブ・PDF を列挙する。隠しファイルは除外し、
/// フォルダを先頭に自然順で並べる。
pub fn read_directory(dir_path: &Path) -> Result<Vec<DirectoryEntry>, String> {
    let entries =
        std::fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {e}"))?;

    let mut result: Vec<DirectoryEntry> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();

            if is_hidden(&name) {
                return None;
            }

            let entry_path = entry.path();
            let is_dir = metadata.is_dir();
            let is_archive = !is_dir && archive::is_archive_file(&name);
            let is_pdf = !is_dir && !is_archive && archive::is_pdf_file(&name);

            // Only show directories, archives, and PDFs
            if !is_dir && !is_archive && !is_pdf {
                return None;
            }

            let has_subfolders = is_dir && has_subdirectories(&entry_path);

            Some(DirectoryEntry {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
                is_archive,
                is_pdf,
                has_subfolders,
            })
        })
        .collect();

    sort_entries(&mut result);
    Ok(result)
}

pub fn read_file_base64(file_path: &Path) -> Result<String, String> {
    let data = std::fs::read(file_path).map_err(|e| format!("Failed to read file: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

fn validate_trash_target(path: &Path) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    Ok(path.to_path_buf())
}

pub fn trash_file(path: &Path) -> Result<(), String> {
    let file_path = validate_trash_target(path)?;
    trash::delete(&file_path).map_err(|e| format!("Failed to move file to trash: {e}"))
}

/// 複数ファイルをゴミ箱へ移動する。全パスを事前検証し、無効なものがあれば何も削除せずまとめて返す。
/// 削除は `delete_all` で 1 回の操作にまとめる（macOS では Finder 呼び出しが 1 回で済む）。
pub fn trash_files(paths: &[PathBuf]) -> Result<(), String> {
    let mut targets = Vec::with_capacity(paths.len());
    let mut errors = Vec::new();
    for path in paths {
        match validate_trash_target(path) {
            Ok(p) => targets.push(p),
            Err(e) => errors.push(e),
        }
    }
    if !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    if targets.is_empty() {
        return Ok(());
    }
    trash::delete_all(&targets).map_err(|e| format!("Failed to move files to trash: {e}"))
}

/// ファイルを別フォルダへ移動し、移動後のパスを返す。同名ファイルがあればエラー。
pub fn move_file(src_path: &Path, dest_dir_path: &Path) -> Result<PathBuf, String> {
    if !src_path.exists() {
        return Err(format!("File does not exist: {}", src_path.display()));
    }
    if !src_path.is_file() {
        return Err(format!("Path is not a file: {}", src_path.display()));
    }
    if !dest_dir_path.is_dir() {
        return Err(format!(
            "Destination is not a directory: {}",
            dest_dir_path.display()
        ));
    }

    // 同一フォルダへの移動は no-op ではなくエラーとして返す
    let src_parent = src_path
        .parent()
        .ok_or_else(|| format!("Invalid file path: {}", src_path.display()))?;
    let same_dir = match (src_parent.canonicalize(), dest_dir_path.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    if same_dir {
        return Err("Source and destination are the same folder".to_string());
    }

    let file_name = src_path
        .file_name()
        .ok_or_else(|| format!("Invalid file path: {}", src_path.display()))?;
    let dest_path = dest_dir_path.join(file_name);
    if dest_path.exists() {
        return Err(format!(
            "A file with the same name already exists: {}",
            dest_path.display()
        ));
    }

    // rename を試し、失敗（クロスデバイス等）なら copy + remove にフォールバック。
    // コピー後の削除失敗は二重存在を許容し、データ喪失は起こさない。
    if std::fs::rename(src_path, &dest_path).is_err() {
        std::fs::copy(src_path, &dest_path).map_err(|e| format!("Failed to copy file: {e}"))?;
        std::fs::remove_file(src_path)
            .map_err(|e| format!("Copied to destination but failed to remove the original: {e}"))?;
    }

    Ok(dest_path)
}

/// ディレクトリ以下を再帰的に検索し、名前に query (大文字小文字無視) を含む
/// フォルダ・アーカイブ・PDF を返す。
pub fn search_directory(dir_path: &Path, query: &str) -> Result<Vec<DirectoryEntry>, String> {
    let query_lower = query.to_lowercase();
    let mut result: Vec<DirectoryEntry> = Vec::new();

    search_recursive(dir_path, &query_lower, &mut result)
        .map_err(|e| format!("Failed to search directory: {e}"))?;

    sort_entries(&mut result);
    Ok(result)
}

fn search_recursive(
    dir: &Path,
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

        if is_hidden(&name) {
            continue;
        }

        let entry_path = entry.path();
        let is_dir = metadata.is_dir();

        if is_dir {
            if name.to_lowercase().contains(query) {
                let has_subfolders = has_subdirectories(&entry_path);
                result.push(DirectoryEntry {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
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
                result.push(DirectoryEntry {
                    name,
                    path: entry_path.to_string_lossy().to_string(),
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

/// フォルダを先頭に、それぞれ自然順で並べる。
fn sort_entries(entries: &mut [DirectoryEntry]) {
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => natord::compare(&a.name, &b.name),
    });
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn has_subdirectories(path: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(path) else {
        return false;
    };
    entries.flatten().any(|entry| {
        entry.metadata().map(|m| m.is_dir()).unwrap_or(false)
            && !is_hidden(&entry.file_name().to_string_lossy())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn trash_file_nonexistent_path() {
        let result = trash_file(Path::new("/tmp/nonexistent_file_mekuri_test_12345.zip"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File does not exist"));
    }

    #[test]
    fn trash_file_directory_path() {
        let dir = tempfile::tempdir().unwrap();
        let result = trash_file(dir.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path is not a file"));
    }

    #[test]
    fn trash_files_reports_all_invalid_paths_without_trashing_anything() {
        let dir = tempfile::tempdir().unwrap();
        let valid = dir.path().join("valid.zip");
        fs::write(&valid, "").unwrap();
        let missing = dir.path().join("missing.zip");
        let err = trash_files(&[valid.clone(), missing, dir.path().to_path_buf()]).unwrap_err();
        assert!(err.contains("missing.zip"), "{err}");
        assert!(err.contains("Path is not a file"), "{err}");
        assert!(
            valid.exists(),
            "valid file must not be trashed when validation fails"
        );
    }

    #[test]
    fn trash_files_empty_is_ok() {
        assert!(trash_files(&[]).is_ok());
    }

    #[test]
    fn read_directory_lists_folders_first_then_archives_and_pdfs_in_natural_order() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("zeta")).unwrap();
        fs::create_dir(dir.path().join(".hidden")).unwrap();
        fs::write(dir.path().join("vol10.zip"), "").unwrap();
        fs::write(dir.path().join("vol2.cbz"), "").unwrap();
        fs::write(dir.path().join("doc.pdf"), "").unwrap();
        fs::write(dir.path().join("notes.txt"), "").unwrap();

        let result = read_directory(dir.path()).unwrap();
        let names: Vec<&str> = result.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["zeta", "doc.pdf", "vol2.cbz", "vol10.zip"]);
        assert!(result[0].is_dir);
        assert!(result[1].is_pdf);
        assert!(result[2].is_archive);
    }

    #[test]
    fn read_directory_reports_has_subfolders_ignoring_hidden_ones() {
        let dir = tempfile::tempdir().unwrap();
        let with_sub = dir.path().join("with_sub");
        fs::create_dir(&with_sub).unwrap();
        fs::create_dir(with_sub.join("child")).unwrap();
        let only_hidden = dir.path().join("only_hidden");
        fs::create_dir(&only_hidden).unwrap();
        fs::create_dir(only_hidden.join(".git")).unwrap();

        let result = read_directory(dir.path()).unwrap();
        let by_name = |n: &str| result.iter().find(|e| e.name == n).unwrap();
        assert!(by_name("with_sub").has_subfolders);
        assert!(!by_name("only_hidden").has_subfolders);
    }

    #[test]
    fn search_directory_finds_matching_files() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("subdir");
        fs::create_dir(&sub).unwrap();
        fs::write(dir.path().join("test.zip"), "").unwrap();
        fs::write(sub.join("nested.zip"), "").unwrap();
        fs::write(sub.join("other.txt"), "").unwrap();

        let result = search_directory(dir.path(), "zip").unwrap();
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

        let result = search_directory(dir.path(), "manga").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "manga_vol1");
        assert!(result[0].is_dir);
    }

    #[test]
    fn search_directory_case_insensitive() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("MyArchive.ZIP"), "").unwrap();

        let result = search_directory(dir.path(), "myarchive").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "MyArchive.ZIP");
    }

    #[test]
    fn search_directory_no_results() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("test.zip"), "").unwrap();

        let result = search_directory(dir.path(), "nonexistent").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    #[ignore] // Requires Finder interaction on macOS; run manually with `cargo test -- --ignored`
    fn trash_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test_trash.txt");
        fs::write(&file_path, "test content").unwrap();
        assert!(file_path.exists());

        let result = trash_file(&file_path);
        assert!(result.is_ok(), "trash_file failed: {:?}", result);
        assert!(!file_path.exists());
    }

    #[test]
    #[ignore] // Requires Finder interaction on macOS; run manually with `cargo test -- --ignored`
    fn trash_files_success() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.zip");
        let b = dir.path().join("b.zip");
        fs::write(&a, "").unwrap();
        fs::write(&b, "").unwrap();

        let result = trash_files(&[a.clone(), b.clone()]);
        assert!(result.is_ok(), "trash_files failed: {:?}", result);
        assert!(!a.exists());
        assert!(!b.exists());
    }

    #[test]
    fn move_file_success() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        fs::write(&src, b"data").unwrap();
        let dest_dir = dir.path().join("sub");
        fs::create_dir(&dest_dir).unwrap();

        let new_path = move_file(&src, &dest_dir).unwrap();
        assert_eq!(new_path, dest_dir.join("a.zip"));
        assert!(!src.exists());
        assert!(dest_dir.join("a.zip").exists());
        assert_eq!(fs::read(dest_dir.join("a.zip")).unwrap(), b"data");
    }

    #[test]
    fn move_file_collision_is_error_and_keeps_source() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        fs::write(&src, b"data").unwrap();
        let dest_dir = dir.path().join("sub");
        fs::create_dir(&dest_dir).unwrap();
        fs::write(dest_dir.join("a.zip"), b"other").unwrap();

        let result = move_file(&src, &dest_dir);

        assert!(result.unwrap_err().contains("already exists"));
        assert!(src.exists());
        assert_eq!(fs::read(dest_dir.join("a.zip")).unwrap(), b"other");
    }

    #[test]
    fn move_file_nonexistent_src() {
        let dir = tempfile::tempdir().unwrap();
        let result = move_file(
            Path::new("/tmp/nonexistent_mekuri_move_12345.zip"),
            dir.path(),
        );
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn move_file_src_is_directory() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        let result = move_file(&sub, dir.path());
        assert!(result.unwrap_err().contains("not a file"));
    }

    #[test]
    fn move_file_dest_not_directory() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        fs::write(&src, b"data").unwrap();
        let result = move_file(&src, &dir.path().join("no_such_dir"));
        assert!(result.unwrap_err().contains("not a directory"));
        assert!(src.exists());
    }

    #[test]
    fn move_file_same_directory_is_error() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("a.zip");
        fs::write(&src, b"data").unwrap();
        let result = move_file(&src, dir.path());
        assert!(result.unwrap_err().contains("same"));
        assert!(src.exists());
    }
}
