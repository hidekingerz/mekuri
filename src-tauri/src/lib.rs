mod archive;
mod commands;
pub mod launch;
pub mod window_label;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(launch::LaunchState::default())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_directory,
            commands::fs::read_file_base64,
            commands::fs::trash_file,
            commands::fs::move_file,
            commands::fs::search_directory,
            commands::archive::list_archive_images,
            commands::archive::get_archive_image,
            commands::archive::analyze_archive_contents,
            commands::archive::extract_nested_archive,
            commands::launch::was_opened_via_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(target_os = "macos")]
        launch::handle_run_event(_app_handle, _event);
    });
}
