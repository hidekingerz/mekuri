use crate::archive::{self as archive_impl, ArchiveContents};

#[tauri::command]
pub fn list_archive_images(archive_path: String) -> Result<Vec<String>, String> {
    archive_impl::list_images(&archive_path)
}

#[tauri::command]
pub fn get_archive_image(archive_path: String, entry_name: String) -> Result<String, String> {
    archive_impl::get_image_base64(&archive_path, &entry_name)
}

#[tauri::command]
pub fn analyze_archive_contents(archive_path: String) -> Result<ArchiveContents, String> {
    archive_impl::analyze_contents(&archive_path)
}

#[tauri::command]
pub fn extract_nested_archive(parent_path: String, nested_name: String) -> Result<String, String> {
    archive_impl::extract_nested_archive(&parent_path, &nested_name)
}
