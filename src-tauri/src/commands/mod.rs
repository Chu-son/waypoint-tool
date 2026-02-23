use tauri::command;
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
pub fn export_waypoints(path: String, waypoints: Vec<serde_json::Value>, template: Option<String>) -> Result<(), String> {
    io::export_waypoints(&path, waypoints, template)
}

pub mod plugins;
pub use plugins::*;
