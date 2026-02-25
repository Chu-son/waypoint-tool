use tauri::{command, AppHandle};
use crate::{map, io, models::ProjectData};

#[command]
pub fn load_ros_map(yaml_path: String) -> Result<map::MapLoadResult, String> {
    map::load_map(&yaml_path)
}

#[command]
pub fn save_project(path: String, data: ProjectData) -> Result<(), String> {
    io::save_project(&path, &data)
}

#[command]
pub fn load_project(path: String) -> Result<ProjectData, String> {
    io::load_project(&path)
}

#[command]
pub fn load_options_schema(yaml_path: String) -> Result<crate::models::options::OptionsSchema, String> {
    crate::models::options::load_options_schema(&yaml_path)
}

#[command]
pub fn export_waypoints(path: String, waypoints: Vec<serde_json::Value>, template: Option<String>, image_data_b64: Option<String>) -> Result<(), String> {
    io::export_waypoints(&path, waypoints, template, image_data_b64)
}

pub mod plugins;
pub use plugins::*;

#[command]
pub fn force_exit(app: AppHandle) {
    app.exit(0);
}

pub fn get_handlers() -> impl Fn(tauri::ipc::Invoke) -> bool {
    tauri::generate_handler![
        load_ros_map,
        save_project,
        load_project,
        export_waypoints,
        load_options_schema,
        force_exit,
        plugins::fetch_installed_plugins,
        plugins::run_plugin,
        plugins::scan_custom_plugin,
        plugins::get_python_environments,
        plugins::scaffold_plugin,
        plugins::check_sdk_version,
        plugins::update_plugin_sdk
    ]
}
