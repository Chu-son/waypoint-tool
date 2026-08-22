use tauri::{command, AppHandle, Manager};
use std::fs;
use std::path::{Path, PathBuf};
use serde_json::Value;

pub fn find_custom_ui_config_path(app: &AppHandle) -> Option<PathBuf> {
    let filename = "custom-ui.config.json";

    // 1. Check user config dir (~/.config/waypoint-tool/custom-ui.config.json)
    if let Ok(config_dir) = app.path().app_config_dir() {
        let p = config_dir.join(filename);
        if p.exists() && p.is_file() {
            return Some(p);
        }
    }

    // 2. Check current executable directory (or $APPIMAGE directory if on Linux AppImage)
    #[cfg(target_os = "linux")]
    {
        if let Ok(appimage_path) = std::env::var("APPIMAGE") {
            if let Some(parent) = Path::new(&appimage_path).parent() {
                let p = parent.join(filename);
                if p.exists() && p.is_file() {
                    return Some(p);
                }
            }
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let p = parent.join(filename);
            if p.exists() && p.is_file() {
                return Some(p);
            }
            // macOS bundle Contents/Resources/
            #[cfg(target_os = "macos")]
            {
                let res_p = parent.join("../Resources").join(filename);
                if res_p.exists() && res_p.is_file() {
                    return Some(res_p);
                }
            }
        }
    }

    // 3. Current working directory or workspace root fallback (dev mode)
    let cwd_p = PathBuf::from(filename);
    if cwd_p.exists() && cwd_p.is_file() {
        return Some(cwd_p);
    }

    #[cfg(debug_assertions)]
    {
        // Try parent directories up to 3 levels in debug mode
        let mut dev_path = PathBuf::from(".");
        for _ in 0..3 {
            let candidate = dev_path.join(filename);
            if candidate.exists() && candidate.is_file() {
                return Some(candidate);
            }
            dev_path.push("..");
        }
    }

    None
}

#[command]
pub fn load_custom_ui_config(app: AppHandle) -> Result<Option<Value>, String> {
    if let Some(path) = find_custom_ui_config_path(&app) {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read Custom UI config at {}: {}", path.display(), e))?;
        let json: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse Custom UI config JSON at {}: {}", path.display(), e))?;
        Ok(Some(json))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::TempDir;
    use serde_json::Value;

    #[test]
    fn test_parse_custom_ui_config_valid() {
        let tmp = TempDir::new().unwrap();
        let config_path = tmp.path().join("custom-ui.config.json");
        let sample_json = r##"{
            "brand": { "appName": "Custom Planner" },
            "theme": { "cssVariables": { "--color-primary-base": "#10b981" } }
        }"##;
        fs::write(&config_path, sample_json).unwrap();

        let content = fs::read_to_string(&config_path).unwrap();
        let parsed: Value = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed["brand"]["appName"], "Custom Planner");
    }
}
