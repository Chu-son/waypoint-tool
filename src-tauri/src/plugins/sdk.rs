//! Locating and copying the bundled Python SDK (wpt_plugin).
use tauri::{AppHandle, Manager};

/// Find the path to the bundled wpt_plugin package directory.
pub(crate) fn find_bundled_sdk_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    // Try resource_dir (bundled app)
    if let Ok(res_dir) = app.path().resource_dir() {
        let sdk_path = res_dir.join("python_sdk").join("wpt_plugin");
        if sdk_path.exists() {
            return Ok(sdk_path);
        }
        // Tauri v2 structure
        let sdk_path_up = res_dir.join("_up_").join("python_sdk").join("wpt_plugin");
        if sdk_path_up.exists() {
            return Ok(sdk_path_up);
        }
    }
    // Fallback for development environment
    if let Ok(current_dir) = std::env::current_dir() {
        for path in &[
            current_dir.join("../python_sdk/wpt_plugin"),
            current_dir.join("python_sdk/wpt_plugin"),
        ] {
            let resolved = path.canonicalize().unwrap_or(path.clone());
            if resolved.exists() {
                return Ok(resolved);
            }
        }
    }
    Err("Could not find bundled wpt_plugin SDK directory.".to_string())
}

pub(crate) fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}
