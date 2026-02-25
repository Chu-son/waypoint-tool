pub mod models;
pub mod map;
pub mod io;
pub mod commands;
pub mod plugins;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_ros_map,
            commands::save_project,
            commands::load_project,
            commands::load_options_schema,
            commands::export_waypoints,
            commands::fetch_installed_plugins,
            commands::run_plugin,
            commands::scan_custom_plugin,
            commands::get_python_environments,
            commands::scaffold_plugin,
            commands::check_sdk_version,
            commands::update_plugin_sdk,
            commands::force_exit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
