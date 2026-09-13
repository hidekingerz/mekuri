//! ファイルシステム操作の Tauri コマンド。引数の変換のみ行い、実処理は `filesystem` に委譲する。

use crate::filesystem::{self, DirectoryEntry};
use std::path::{Path, PathBuf};

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    filesystem::read_directory(Path::new(&path))
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    filesystem::read_file_base64(Path::new(&path))
}

#[tauri::command]
pub fn trash_file(path: String) -> Result<(), String> {
    filesystem::trash_file(Path::new(&path))
}

#[tauri::command]
pub fn trash_files(paths: Vec<String>) -> Result<(), String> {
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    filesystem::trash_files(&paths)
}

#[tauri::command]
pub fn move_file(src: String, dest_dir: String) -> Result<String, String> {
    let dest_path = filesystem::move_file(Path::new(&src), Path::new(&dest_dir))?;
    dest_path
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| "Destination path is not valid UTF-8".to_string())
}

#[tauri::command]
pub fn search_directory(path: String, query: String) -> Result<Vec<DirectoryEntry>, String> {
    filesystem::search_directory(Path::new(&path), &query)
}
