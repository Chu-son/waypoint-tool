//! Tauri commands for discovering, creating and running plugins.
//! The process-execution logic lives in `plugins::runner`, SDK file handling in `plugins::sdk`.
use crate::plugins::manager::{detect_sdk_version, get_bundled_sdk_version, load_plugin_dir, PluginManager};
use crate::plugins::models::PluginInstance;
use crate::plugins::runner::run_plugin_sync;
use crate::plugins::sdk::{copy_dir_recursive, find_bundled_sdk_path};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn fetch_installed_plugins(app: AppHandle) -> Result<Vec<PluginInstance>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find app_data_dir: {}", e))?;

    let resource_dir = app.path().resource_dir().ok();

    let manager = PluginManager::new(&app_data_dir, resource_dir);
    manager.scan_plugins()
}

/// Parse a plugin at the specified directory if it contains a valid `manifest.json`.
pub fn parse_plugin_at_dir(p: &std::path::Path) -> Result<PluginInstance, String> {
    load_plugin_dir(p, false)
}

#[tauri::command]
pub fn scan_custom_plugin(path: String) -> Result<PluginInstance, String> {
    let p = std::path::Path::new(&path);
    parse_plugin_at_dir(p)
}

fn scan_dir_for_plugins(dir: &std::path::Path, depth: usize, max_depth: usize, results: &mut Vec<PluginInstance>) {
    if depth > max_depth {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut entries_vec = Vec::new();
    for entry in entries.flatten() {
        entries_vec.push(entry.path());
    }
    entries_vec.sort();

    for path in entries_vec {
        if !path.is_dir() {
            continue;
        }

        let file_name = path.file_name().unwrap_or_default().to_string_lossy();
        // Skip hidden directories and common dependency/build directories
        if file_name.starts_with('.')
            || file_name == "node_modules"
            || file_name == "target"
            || file_name == "__pycache__"
            || file_name == "venv"
            || file_name == ".venv"
        {
            continue;
        }

        let manifest_path = path.join("manifest.json");
        if manifest_path.exists() {
            match parse_plugin_at_dir(&path) {
                Ok(instance) => {
                    results.push(instance);
                    // Do not descend further into an already detected plugin directory
                    continue;
                }
                Err(e) => {
                    eprintln!("[WARN] Failed to parse plugin at {:?}: {}", path, e);
                }
            }
        }

        // Manifest was not present, search child directories
        scan_dir_for_plugins(&path, depth + 1, max_depth, results);
    }
}

/// Scan custom plugins from a directory.
/// If the directory itself contains `manifest.json`, it returns that single plugin.
/// Otherwise, it scans subdirectories recursively (up to depth 3) for all plugins.
#[tauri::command]
pub fn scan_custom_plugins(path: String) -> Result<Vec<PluginInstance>, String> {
    let p = std::path::Path::new(&path);
    if !p.is_dir() {
        return Err("Provided path is not a directory.".to_string());
    }

    // 1. Direct manifest check: if path itself contains manifest.json, return it as a single plugin
    let direct_manifest = p.join("manifest.json");
    if direct_manifest.exists() {
        let plugin = parse_plugin_at_dir(p)?;
        return Ok(vec![plugin]);
    }

    // 2. Scan subdirectories up to depth 3
    let mut plugins = Vec::new();
    scan_dir_for_plugins(p, 1, 3, &mut plugins);

    if plugins.is_empty() {
        return Err(
            "No valid plugins (manifest.json) found in the selected directory or its subdirectories.".to_string(),
        );
    }

    Ok(plugins)
}

/// Generate a new plugin scaffold with manifest.json, main.py, and a copy of wpt_plugin.py SDK.
#[tauri::command]
pub fn scaffold_plugin(app: AppHandle, plugin_name: String, target_dir: String) -> Result<PluginInstance, String> {
    let target = std::path::Path::new(&target_dir);
    let plugin_dir = target.join(&plugin_name);

    if plugin_dir.exists() {
        return Err(format!("Directory already exists: {}", plugin_dir.display()));
    }

    std::fs::create_dir_all(&plugin_dir).map_err(|e| format!("Failed to create plugin directory: {}", e))?;

    // Generate manifest.json
    let manifest_json = format!(
        r#"{{
    "name": "{}",
    "version": "1.0.0",
    "description": "",
    "type": "python",
    "executable": "main.py",
    "inputs": [
        {{"id": "start_point", "label": "Start Point", "type": "point"}}
    ],
    "needs": [],
    "properties": [
        {{"name": "count", "label": "Number of Points", "type": "integer", "default": 5}},
        {{"name": "spacing", "label": "Spacing (m)", "type": "float", "default": 1.0}}
    ]
}}"#,
        plugin_name
    );

    std::fs::write(plugin_dir.join("manifest.json"), &manifest_json)
        .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

    // Generate main.py
    let main_py = format!(
        r#""""\n{} Plugin\n"""\nimport sys\nimport os\nimport math\n\nsys.path.append(os.path.dirname(__file__))\nfrom wpt_plugin.core import WaypointGenerator\nfrom wpt_plugin.geometry import Point\n\n\nclass {}Generator(WaypointGenerator):\n    def generate(self, context):\n        # Get start point as an object\n        start = self.get_interaction_point(context, "start_point")\n        if not start:\n            return []\n\n        count = int(self.get_property(context, "count", default=5))\n        spacing = float(self.get_property(context, "spacing", default=1.0))\n\n        waypoints = []\n        for i in range(count):\n            # Use geometry helper or to_world if needed\n            wp_pt = Point(i * spacing, 0).to_world(start.x, start.y, start.yaw)\n            waypoints.append(self.make_waypoint(wp_pt.x, wp_pt.y, wp_pt.yaw))\n\n        self.log(f"Generated {{len(waypoints)}} waypoints.")\n        return waypoints\n\n\nif __name__ == "__main__":\n    {}Generator().run_from_stdin()\n"#,
        plugin_name,
        plugin_name.replace(" ", "").replace("-", "").replace("_", ""),
        plugin_name.replace(" ", "").replace("-", "").replace("_", ""),
    );

    std::fs::write(plugin_dir.join("main.py"), &main_py).map_err(|e| format!("Failed to write main.py: {}", e))?;

    // Copy SDK directory from bundled resources
    let sdk_source = find_bundled_sdk_path(&app)?;
    let sdk_dest = plugin_dir.join("wpt_plugin");
    copy_dir_recursive(&sdk_source, &sdk_dest).map_err(|e| format!("Failed to copy wpt_plugin SDK: {}", e))?;

    // Return the new plugin instance
    scan_custom_plugin(plugin_dir.to_string_lossy().to_string())
}

/// Return the version of the bundled SDK.
#[tauri::command]
pub fn check_sdk_version(app: AppHandle) -> Result<String, String> {
    let resource_dir = app.path().resource_dir().ok();
    get_bundled_sdk_version(resource_dir.as_deref())
        .ok_or_else(|| "Could not determine bundled SDK version.".to_string())
}

/// Update the SDK in a plugin directory with the bundled version.
#[tauri::command]
pub fn update_plugin_sdk(app: AppHandle, plugin_folder_path: String) -> Result<String, String> {
    let sdk_source = find_bundled_sdk_path(&app)?;
    let plugin_dir = std::path::Path::new(&plugin_folder_path);

    // Remove old wpt_plugin.py if it exists (legacy)
    let old_sdk_file = plugin_dir.join("wpt_plugin.py");
    if old_sdk_file.exists() {
        let _ = std::fs::remove_file(old_sdk_file);
    }

    // Copy new directory
    let sdk_dest = plugin_dir.join("wpt_plugin");
    if sdk_dest.exists() {
        std::fs::remove_dir_all(&sdk_dest).map_err(|e| format!("Failed to clear old SDK dir: {}", e))?;
    }

    copy_dir_recursive(&sdk_source, &sdk_dest).map_err(|e| format!("Failed to copy SDK: {}", e))?;

    // Return the new version
    detect_sdk_version(plugin_dir).ok_or_else(|| "SDK was written but version could not be read back.".to_string())
}

#[tauri::command]
pub async fn run_plugin(
    app: AppHandle,
    plugin_instance: PluginInstance,
    context_json: String,
    python_path: Option<String>,
    map_layers: Option<Vec<crate::plugins::models::PluginMapLayer>>,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_plugin_sync(plugin_instance, context_json, python_path, map_layers, Some(&app))
    })
    .await
    .map_err(|e| format!("Plugin task execution failed to join: {}", e))?
}

#[tauri::command]
pub fn get_python_environments() -> Vec<String> {
    let mut envs = Vec::new();

    let std_cmds = if cfg!(windows) {
        vec!["python", "python3"]
    } else {
        vec!["python3", "python"]
    };

    for cmd in std_cmds {
        let which_cmd = if cfg!(windows) { "where" } else { "which" };
        let args = if cfg!(windows) { vec![cmd] } else { vec!["-a", cmd] };

        if let Ok(output) = std::process::Command::new(which_cmd).args(&args).output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let path = line.trim().to_string();
                    if !path.is_empty() && !envs.contains(&path) {
                        envs.push(path);
                    }
                }
            }
        }
    }

    // Check pyenv locations
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    if !home_dir.is_empty() {
        let pyenv_versions = std::path::Path::new(&home_dir).join(".pyenv").join("versions");
        if pyenv_versions.exists() {
            if let Ok(entries) = std::fs::read_dir(pyenv_versions) {
                for entry in entries.flatten() {
                    let bin_path = entry
                        .path()
                        .join("bin")
                        .join(if cfg!(windows) { "python.exe" } else { "python" });
                    if bin_path.exists() {
                        let path_str = bin_path.to_string_lossy().to_string();
                        if !envs.contains(&path_str) {
                            envs.push(path_str);
                        }
                    }
                }
            }
        }
    }

    // Fallbacks if nothing found from system commands
    if envs.is_empty() {
        if cfg!(windows) {
            envs.push("python".to_string());
        } else {
            envs.push("python3".to_string());
            envs.push("python".to_string());
        }
    }

    envs
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_scan_custom_plugin_valid() {
        let tmp = TempDir::new().unwrap();
        let plugin_dir = tmp.path().join("my_custom_p");
        fs::create_dir_all(&plugin_dir).unwrap();

        let manifest = r#"{
            "name": "Custom",
            "type": "python",
            "executable": "run.py",
            "inputs": [],
            "properties": []
        }"#;
        fs::write(plugin_dir.join("manifest.json"), manifest).unwrap();

        let res = scan_custom_plugin(plugin_dir.to_string_lossy().to_string());
        assert!(res.is_ok());
        let p = res.unwrap();
        assert_eq!(p.manifest.name, "Custom");
        assert_eq!(p.id, "my_custom_p");
        assert!(!p.is_builtin);
    }

    #[test]
    fn test_scan_custom_plugin_missing_manifest() {
        let tmp = TempDir::new().unwrap();
        let plugin_dir = tmp.path().join("no_manifest");
        fs::create_dir_all(&plugin_dir).unwrap();

        let res = scan_custom_plugin(plugin_dir.to_string_lossy().to_string());
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("manifest.json not found"));
    }

    #[test]
    fn test_scan_custom_plugins_direct_manifest() {
        let tmp = TempDir::new().unwrap();
        let plugin_dir = tmp.path().join("single_plugin");
        fs::create_dir_all(&plugin_dir).unwrap();
        let manifest = r#"{
            "name": "Single Plugin",
            "type": "python",
            "executable": "run.py",
            "inputs": [],
            "properties": []
        }"#;
        fs::write(plugin_dir.join("manifest.json"), manifest).unwrap();

        let res = scan_custom_plugins(plugin_dir.to_string_lossy().to_string());
        assert!(res.is_ok());
        let plugins = res.unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].id, "single_plugin");
        assert_eq!(plugins[0].manifest.name, "Single Plugin");
    }

    #[test]
    fn test_scan_custom_plugins_subdirectories() {
        let tmp = TempDir::new().unwrap();
        let root_dir = tmp.path().join("plugins_bundle");
        fs::create_dir_all(&root_dir).unwrap();

        // plugin A
        let p_a = root_dir.join("plugin_a");
        fs::create_dir_all(&p_a).unwrap();
        fs::write(
            p_a.join("manifest.json"),
            r#"{"name": "Plugin A", "type": "python", "executable": "a.py"}"#,
        )
        .unwrap();

        // plugin B
        let p_b = root_dir.join("plugin_b");
        fs::create_dir_all(&p_b).unwrap();
        fs::write(
            p_b.join("manifest.json"),
            r#"{"name": "Plugin B", "type": "python", "executable": "b.py"}"#,
        )
        .unwrap();

        // directory without manifest
        let other = root_dir.join("not_a_plugin");
        fs::create_dir_all(&other).unwrap();

        let res = scan_custom_plugins(root_dir.to_string_lossy().to_string());
        assert!(res.is_ok());
        let plugins = res.unwrap();
        assert_eq!(plugins.len(), 2);
        let names: Vec<_> = plugins.iter().map(|p| p.manifest.name.as_str()).collect();
        assert!(names.contains(&"Plugin A"));
        assert!(names.contains(&"Plugin B"));
    }

    #[test]
    fn test_scan_custom_plugins_nested_and_skips_ignored() {
        let tmp = TempDir::new().unwrap();
        let root_dir = tmp.path().join("nested_repo");
        fs::create_dir_all(&root_dir).unwrap();

        // category/plugin_c
        let p_c = root_dir.join("category").join("plugin_c");
        fs::create_dir_all(&p_c).unwrap();
        fs::write(
            p_c.join("manifest.json"),
            r#"{"name": "Plugin C", "type": "python", "executable": "c.py"}"#,
        )
        .unwrap();

        // .venv/ignored_plugin should be skipped
        let ignored = root_dir.join(".venv").join("ignored_plugin");
        fs::create_dir_all(&ignored).unwrap();
        fs::write(
            ignored.join("manifest.json"),
            r#"{"name": "Ignored", "type": "python", "executable": "i.py"}"#,
        )
        .unwrap();

        // node_modules/ignored_plugin should be skipped
        let nm = root_dir.join("node_modules").join("ignored_npm");
        fs::create_dir_all(&nm).unwrap();
        fs::write(
            nm.join("manifest.json"),
            r#"{"name": "Ignored NPM", "type": "python", "executable": "i.py"}"#,
        )
        .unwrap();

        let res = scan_custom_plugins(root_dir.to_string_lossy().to_string());
        assert!(res.is_ok());
        let plugins = res.unwrap();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].id, "plugin_c");
        assert_eq!(plugins[0].manifest.name, "Plugin C");
    }

    #[test]
    fn test_scan_custom_plugins_none_found() {
        let tmp = TempDir::new().unwrap();
        let empty_dir = tmp.path().join("empty_folder");
        fs::create_dir_all(&empty_dir).unwrap();

        let res = scan_custom_plugins(empty_dir.to_string_lossy().to_string());
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("No valid plugins"));
    }

    #[test]
    fn test_get_python_environments_not_empty() {
        let envs = get_python_environments();
        // Should at least return the fallback "python" or "python3"
        assert!(!envs.is_empty());
    }
}
