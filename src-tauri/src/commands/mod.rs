use tauri::{command, AppHandle};
use std::fs;
use base64::{engine::general_purpose, Engine as _};
use crate::{map, io, models::ProjectData};

#[command]
pub fn load_ros_map(yaml_path: String) -> Result<map::MapLoadResult, String> {
    map::load_map(&yaml_path)
}

#[command]
pub fn export_maps(options: map::ExportMapsOptions) -> Result<(), String> {
    map::export_maps(options)
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

#[command]
pub fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read image file: {}", e))?;
    
    // Determine mime type from extension
    let mime_type = match std::path::Path::new(&path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };
    
    let base64_str = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime_type, base64_str))
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
        export_maps,
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
        plugins::update_plugin_sdk,
        read_image_base64
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_read_image_base64_png() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.png");
        fs::write(&file_path, b"fake png data").unwrap();

        let res = read_image_base64(file_path.to_string_lossy().to_string());
        assert!(res.is_ok());
        let s = res.unwrap();
        assert!(s.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn test_read_image_base64_jpg() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.jpg");
        fs::write(&file_path, b"fake jpg data").unwrap();

        let res = read_image_base64(file_path.to_string_lossy().to_string());
        assert!(res.is_ok());
        let s = res.unwrap();
        assert!(s.starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn test_read_image_base64_unknown() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.unknown");
        fs::write(&file_path, b"data").unwrap();

        let res = read_image_base64(file_path.to_string_lossy().to_string());
        assert!(res.is_ok());
        let s = res.unwrap();
        assert!(s.starts_with("data:application/octet-stream;base64,"));
    }
}
