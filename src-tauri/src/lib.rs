mod archive;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_directory,
            commands::fs::trash_file,
            commands::archive::list_archive_images,
            commands::archive::get_archive_image,
            commands::archive::analyze_archive_contents,
            commands::archive::extract_nested_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
