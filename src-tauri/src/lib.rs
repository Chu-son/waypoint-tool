pub mod models;
pub mod map;
pub mod io;
pub mod commands;
pub mod plugins;

use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::VISIBLE
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_ros_map,
            commands::export_maps,
            commands::blend_map_preview,
            commands::save_project,
            commands::load_project,
            commands::load_options_schema,
            commands::export_waypoints,
            commands::import_waypoints,
            commands::infer_import_mapping,
            commands::read_text_file,
            commands::write_text_file,
            commands::fetch_installed_plugins,
            commands::run_plugin,
            commands::scan_custom_plugin,
            commands::get_python_environments,
            commands::scaffold_plugin,
            commands::check_sdk_version,
            commands::update_plugin_sdk,
            commands::read_image_base64,
            commands::force_exit,
            commands::open_devtools,
            commands::load_custom_ui_config,
            commands::load_custom_ui_preset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
