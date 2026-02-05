mod archive;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_directory,
            commands::archive::list_archive_images,
            commands::archive::get_archive_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
