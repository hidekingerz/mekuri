use crate::archive as archive_impl;

#[tauri::command]
pub fn list_archive_images(archive_path: String) -> Result<Vec<String>, String> {
    archive_impl::list_images(&archive_path)
}

#[tauri::command]
pub fn get_archive_image(archive_path: String, entry_name: String) -> Result<String, String> {
    archive_impl::get_image_base64(&archive_path, &entry_name)
}
