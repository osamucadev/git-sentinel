mod commands;
mod watch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(watch::WatchRegistry::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::validate_repository,
            commands::inspect_repository,
            commands::fetch_repository,
            commands::push_repository,
            commands::list_repository_changes,
            commands::repository_file_diff,
            commands::watch_repository,
            commands::unwatch_repository,
            commands::open_in_terminal,
            commands::open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
