use crate::plugins::manager::{PluginManager, detect_sdk_version, get_bundled_sdk_version};
use crate::plugins::models::PluginInstance;
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

#[tauri::command]
pub fn scan_custom_plugin(path: String) -> Result<PluginInstance, String> {
    let p = std::path::Path::new(&path);
    if !p.is_dir() {
        return Err("Provided path is not a directory.".to_string());
    }

    let manifest_path = p.join("manifest.json");
    if !manifest_path.exists() {
        return Err("manifest.json not found in the provided directory.".to_string());
    }

    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest.json: {}", e))?;

    let manifest: crate::plugins::models::PluginManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest.json: {}", e))?;

    let id = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    let sdk_version = detect_sdk_version(p);

    Ok(PluginInstance {
        id,
        manifest,
        folder_path: p.to_string_lossy().to_string(),
        is_builtin: false,
        sdk_version,
    })
}

/// Generate a new plugin scaffold with manifest.json, main.py, and a copy of wpt_plugin.py SDK.
#[tauri::command]
pub fn scaffold_plugin(app: AppHandle, plugin_name: String, target_dir: String) -> Result<PluginInstance, String> {
    let target = std::path::Path::new(&target_dir);
    let plugin_dir = target.join(&plugin_name);

    if plugin_dir.exists() {
        return Err(format!("Directory already exists: {}", plugin_dir.display()));
    }

    std::fs::create_dir_all(&plugin_dir)
        .map_err(|e| format!("Failed to create plugin directory: {}", e))?;

    // Generate manifest.json
    let manifest_json = format!(r#"{{
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
}}"#, plugin_name);

    std::fs::write(plugin_dir.join("manifest.json"), &manifest_json)
        .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

    // Generate main.py
    let main_py = format!(r#""""\n{} Plugin\n"""\nimport sys\nimport os\nimport math\n\nsys.path.append(os.path.dirname(__file__))\nfrom wpt_plugin.core import WaypointGenerator\nfrom wpt_plugin.geometry import Point\n\n\nclass {}Generator(WaypointGenerator):\n    def generate(self, context):\n        # Get start point as an object\n        start = self.get_interaction_point(context, "start_point")\n        if not start:\n            return []\n\n        count = int(self.get_property(context, "count", default=5))\n        spacing = float(self.get_property(context, "spacing", default=1.0))\n\n        waypoints = []\n        for i in range(count):\n            # Use geometry helper or to_world if needed\n            wp_pt = Point(i * spacing, 0).to_world(start.x, start.y, start.yaw)\n            waypoints.append(self.make_waypoint(wp_pt.x, wp_pt.y, wp_pt.yaw))\n\n        self.log(f"Generated {{len(waypoints)}} waypoints.")\n        return waypoints\n\n\nif __name__ == "__main__":\n    {}Generator().run_from_stdin()\n"#,
        plugin_name,
        plugin_name.replace(" ", "").replace("-", "").replace("_", ""),
        plugin_name.replace(" ", "").replace("-", "").replace("_", ""),
    );

    std::fs::write(plugin_dir.join("main.py"), &main_py)
        .map_err(|e| format!("Failed to write main.py: {}", e))?;

    // Copy SDK directory from bundled resources
    let sdk_source = find_bundled_sdk_path(&app)?;
    let sdk_dest = plugin_dir.join("wpt_plugin");
    copy_dir_recursive(&sdk_source, &sdk_dest)
        .map_err(|e| format!("Failed to copy wpt_plugin SDK: {}", e))?;

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
    
    copy_dir_recursive(&sdk_source, &sdk_dest)
        .map_err(|e| format!("Failed to copy SDK: {}", e))?;

    // Return the new version
    detect_sdk_version(plugin_dir)
        .ok_or_else(|| "SDK was written but version could not be read back.".to_string())
}

/// Find the path to the bundled wpt_plugin package directory.
fn find_bundled_sdk_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
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

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
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

/// Filter plugins of type `python_library` or having `module_name` set, and return deduplicated folder paths.
pub fn collect_python_library_paths_from_plugins(plugins: &[PluginInstance]) -> Vec<std::path::PathBuf> {
    let mut paths = Vec::new();
    for p in plugins {
        let has_module = p.manifest.module_name.as_ref().map_or(false, |m| !m.trim().is_empty());
        if p.manifest.plugin_type == "python_library" || has_module {
            let path = std::path::PathBuf::from(&p.folder_path);
            if !path.as_os_str().is_empty() && !paths.contains(&path) {
                paths.push(path);
            }
        }
    }
    paths
}

/// Construct a clean PYTHONPATH using the OS-specific delimiter (';' on Windows, ':' on Unix).
pub fn build_safe_python_path(paths: &[std::path::PathBuf]) -> String {
    let sep = if cfg!(windows) { ";" } else { ":" };
    paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .filter(|s| !s.trim().is_empty())
        .collect::<Vec<String>>()
        .join(sep)
}

/// Collect paths of all currently scanned/installed plugins that are of type `python_library`
/// (or have `module_name` set), plus bundled SDK directory if available.
pub fn collect_python_library_paths(app: Option<&AppHandle>) -> Vec<std::path::PathBuf> {
    let mut plugins = Vec::new();

    if let Some(app) = app {
        if let Ok(app_data_dir) = app.path().app_data_dir() {
            let resource_dir = app.path().resource_dir().ok();
            let manager = PluginManager::new(&app_data_dir, resource_dir);
            if let Ok(scanned) = manager.scan_plugins() {
                plugins.extend(scanned);
            }
        }
    } else {
        // Fallback for tests / environment without AppHandle
        if let Ok(current_dir) = std::env::current_dir() {
            for dev_dir in &[
                current_dir.join("../python_sdk"),
                current_dir.join("python_sdk"),
            ] {
                let resolved = dev_dir.canonicalize().unwrap_or_else(|_| dev_dir.clone());
                if resolved.exists() && resolved.is_dir() {
                    plugins.extend(PluginManager::scan_plugins_in_dir(&resolved, true));
                }
            }
        }
    }

    let mut paths = collect_python_library_paths_from_plugins(&plugins);

    // If bundled SDK (python_sdk/wpt_plugin) exists, ensure its parent directory
    // (python_sdk) is included so wpt_plugin is importable
    if let Some(app) = app {
        if let Ok(sdk_dir) = find_bundled_sdk_path(app) {
            if let Some(parent) = sdk_dir.parent() {
                let parent_buf = parent.to_path_buf();
                if !paths.contains(&parent_buf) {
                    paths.push(parent_buf);
                }
            }
        }
    } else if let Ok(current_dir) = std::env::current_dir() {
        for dev_path in &[
            current_dir.join("../python_sdk"),
            current_dir.join("python_sdk"),
        ] {
            let resolved = dev_path.canonicalize().unwrap_or_else(|_| dev_path.clone());
            if resolved.join("wpt_plugin").exists() && !paths.contains(&resolved) {
                paths.push(resolved);
            }
        }
    }

    paths
}

pub fn run_plugin_sync(
    plugin_instance: PluginInstance,
    context_json: String,
    python_path: Option<String>,
    map_layers: Option<Vec<crate::plugins::models::PluginMapLayer>>,
    app: Option<&AppHandle>,
) -> Result<serde_json::Value, String> {
    // 【プラグイン・アーキテクチャの背景】
    // このツールでは、外部の経路生成アルゴリズム（PythonやWebAssembly）と連携するために、
    // セキュリティと拡張性、言語非依存性を重視し、「標準入出力ストリームを介したJSON通信」を採用しています。
    // プロセス間通信（IPC）にstdin/stdoutを用いることで、複雑なRPCライブラリを介さずとも
    // 開発者が使い慣れた言語で柔軟に拡張機能を作成できるよう設計されています。
    
    if plugin_instance.manifest.plugin_type == "python" {
        if plugin_instance.manifest.executable.trim().is_empty() {
            return Err(format!(
                "Plugin '{}' does not specify an executable.",
                plugin_instance.manifest.name
            ));
        }

        use std::process::{Command, Stdio};
        
        let default_cmd = if cfg!(windows) { "python".to_string() } else { "python3".to_string() };
        let py_cmd = match python_path {
            Some(p) if !p.trim().is_empty() => p.trim().to_string(),
            _ => default_cmd,
        };

        // Construct clean safe PYTHONPATH containing all scanned python_library plugins
        let library_paths = collect_python_library_paths(app);
        let safe_python_path = build_safe_python_path(&library_paths);
        
        println!("[DEBUG/RUST] Executing plugin: {} with cmd: {}", plugin_instance.manifest.executable, py_cmd);
        println!("[DEBUG/RUST] Using Context JSON: {}", context_json);
        if !safe_python_path.is_empty() {
            println!("[DEBUG/RUST] Using safe PYTHONPATH: {}", safe_python_path);
        }

        let mut cmd = Command::new(&py_cmd);
        cmd.arg(&plugin_instance.manifest.executable)
            .current_dir(&plugin_instance.folder_path)
            .env_remove("PYTHONHOME")
            .env_remove("PYTHONPATH") // Remove inherited/untrusted system PYTHONPATH
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if !safe_python_path.is_empty() {
            cmd.env("PYTHONPATH", &safe_python_path);
        }

        let child_res = cmd.spawn();

        let mut child = match child_res {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound && py_cmd == "python" && !cfg!(windows) => {
                println!("[DEBUG/RUST] 'python' command not found. Falling back to 'python3'...");
                let mut cmd3 = Command::new("python3");
                cmd3.arg(&plugin_instance.manifest.executable)
                    .current_dir(&plugin_instance.folder_path)
                    .env_remove("PYTHONHOME")
                    .env_remove("PYTHONPATH")
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());

                if !safe_python_path.is_empty() {
                    cmd3.env("PYTHONPATH", &safe_python_path);
                }

                cmd3.spawn()
                    .map_err(|e2| format!("Failed to spawn python (also tried python3): {}", e2))?
            }
            Err(e) => return Err(format!("Failed to spawn python ({}): {}", py_cmd, e)),
        };

        let mut context: serde_json::Value = serde_json::from_str(&context_json)
            .map_err(|e| format!("Failed to parse context_json: {}", e))?;

        let needs = &plugin_instance.manifest.needs;
        let needs_grid = needs.iter().any(|n| n == "occupancy_grid" || n == "occupancy_grid_in_region");

        if needs_grid {
            if let Some(layers) = &map_layers {
                let active_layers: Vec<_> = layers.iter().filter(|l| l.visible).collect();

                if !active_layers.is_empty() {
                    let grid = crate::map::occupancy::build_occupancy_grid_from_layers(&active_layers)?;
                    context["occupancy_grid"] = serde_json::to_value(&grid)
                        .map_err(|e| format!("Failed to serialize occupancy grid: {}", e))?;
                }
            }
        }

        let enriched_json = serde_json::to_string(&context)
            .map_err(|e| format!("Failed to serialize context: {}", e))?;

        let stdin_handle = if let Some(mut stdin) = child.stdin.take() {
            let json_bytes = enriched_json.into_bytes();
            Some(std::thread::spawn(move || {
                use std::io::Write;
                let _ = stdin.write_all(&json_bytes);
            }))
        } else {
            None
        };

        let output = child.wait_with_output()
            .map_err(|e| format!("Failed to wait for python plugin: {}", e))?;

        if let Some(handle) = stdin_handle {
            let _ = handle.join();
        }

        if !output.status.success() {
            let err_str = String::from_utf8_lossy(&output.stderr);
            println!("[DEBUG/RUST] Execution Failed stderror:\n{}", err_str);
            return Err(format!("Plugin execution failed:\n{}", err_str));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        println!("[DEBUG/RUST] Execution Success stdout:\n{}", stdout_str);
        println!("[DEBUG/RUST] Execution Success stderr:\n{}", stderr_str);
        
        let result: serde_json::Value = serde_json::from_str(&stdout_str)
            .map_err(|e| {
                println!("[DEBUG/RUST] JSON Parse Error: {}", e);
                format!("Failed to parse plugin output as JSON: {}\nOutput was:\n{}", e, stdout_str)
            })?;

        Ok(result)
    } else if plugin_instance.manifest.plugin_type == "wasm" {
        let wasm_file = std::path::Path::new(&plugin_instance.folder_path)
            .join(&plugin_instance.manifest.executable);
            
        crate::plugins::wasm_runner::run_wasm_plugin(
            wasm_file.to_str().unwrap(),
            &context_json
        )
    } else {
        Err("Unsupported plugin type. Only 'python' and 'wasm' are currently supported.".to_string())
    }
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

    let std_cmds = if cfg!(windows) { vec!["python", "python3"] } else { vec!["python3", "python"] };
    
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
    let home_dir = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
    if !home_dir.is_empty() {
        let pyenv_versions = std::path::Path::new(&home_dir).join(".pyenv").join("versions");
        if pyenv_versions.exists() {
            if let Ok(entries) = std::fs::read_dir(pyenv_versions) {
                for entry in entries.flatten() {
                    let bin_path = entry.path().join("bin").join(if cfg!(windows) { "python.exe" } else { "python" });
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
    fn test_get_python_environments_not_empty() {
        let envs = get_python_environments();
        // Should at least return the fallback "python" or "python3"
        assert!(!envs.is_empty());
    }

    #[test]
    fn test_collect_python_library_paths_and_build_safe_python_path() {
        let manifest_lib = crate::plugins::models::PluginManifest {
            name: "Lib A".to_string(),
            version: Some("1.0.0".to_string()),
            category: None,
            primary_output: None,
            description: None,
            plugin_type: "python_library".to_string(),
            executable: "".to_string(),
            module_name: Some("lib_a".to_string()),
            inputs: vec![],
            needs: vec![],
            icon: None,
            properties: vec![],
            legacy_ids: vec![],
            plugin_dependencies: vec![],
            python_dependencies: vec![],
            pipeline: None,
        };
        let p1 = PluginInstance {
            id: "lib_a".to_string(),
            manifest: manifest_lib,
            folder_path: "/path/to/lib_a".to_string(),
            is_builtin: true,
            sdk_version: None,
        };

        let manifest_exec = crate::plugins::models::PluginManifest {
            name: "Exec Plugin".to_string(),
            version: Some("1.0.0".to_string()),
            category: None,
            primary_output: None,
            description: None,
            plugin_type: "python".to_string(),
            executable: "main.py".to_string(),
            module_name: None,
            inputs: vec![],
            needs: vec![],
            icon: None,
            properties: vec![],
            legacy_ids: vec![],
            plugin_dependencies: vec![],
            python_dependencies: vec![],
            pipeline: None,
        };
        let p2 = PluginInstance {
            id: "exec_plugin".to_string(),
            manifest: manifest_exec,
            folder_path: "/path/to/exec".to_string(),
            is_builtin: false,
            sdk_version: None,
        };

        let manifest_mod = crate::plugins::models::PluginManifest {
            name: "Module Plugin".to_string(),
            version: Some("1.0.0".to_string()),
            category: None,
            primary_output: None,
            description: None,
            plugin_type: "python".to_string(),
            executable: "".to_string(),
            module_name: Some("mod_b".to_string()),
            inputs: vec![],
            needs: vec![],
            icon: None,
            properties: vec![],
            legacy_ids: vec![],
            plugin_dependencies: vec![],
            python_dependencies: vec![],
            pipeline: None,
        };
        let p3 = PluginInstance {
            id: "mod_b".to_string(),
            manifest: manifest_mod.clone(),
            folder_path: "/path/to/mod_b".to_string(),
            is_builtin: false,
            sdk_version: None,
        };

        // Also test duplicate path deduplication
        let p4 = PluginInstance {
            id: "mod_b_dup".to_string(),
            manifest: manifest_mod.clone(),
            folder_path: "/path/to/mod_b".to_string(),
            is_builtin: false,
            sdk_version: None,
        };

        let paths = collect_python_library_paths_from_plugins(&[p1, p2, p3, p4]);
        assert_eq!(paths.len(), 2);
        assert_eq!(paths[0], std::path::PathBuf::from("/path/to/lib_a"));
        assert_eq!(paths[1], std::path::PathBuf::from("/path/to/mod_b"));

        let joined = build_safe_python_path(&paths);
        let expected_sep = if cfg!(windows) { ";" } else { ":" };
        assert_eq!(joined, format!("/path/to/lib_a{}/path/to/mod_b", expected_sep));
    }

    #[test]
    fn test_collect_python_library_paths_skips_empty_module_name() {
        let manifest_empty_mod = crate::plugins::models::PluginManifest {
            name: "Empty Mod".to_string(),
            version: Some("1.0.0".to_string()),
            category: None,
            primary_output: None,
            description: None,
            plugin_type: "python".to_string(),
            executable: "main.py".to_string(),
            module_name: Some("   ".to_string()),
            inputs: vec![],
            needs: vec![],
            icon: None,
            properties: vec![],
            legacy_ids: vec![],
            plugin_dependencies: vec![],
            python_dependencies: vec![],
            pipeline: None,
        };
        let p = PluginInstance {
            id: "empty_mod".to_string(),
            manifest: manifest_empty_mod,
            folder_path: "/path/to/empty_mod".to_string(),
            is_builtin: false,
            sdk_version: None,
        };
        let paths = collect_python_library_paths_from_plugins(&[p]);
        assert!(paths.is_empty());
    }

    #[test]
    fn test_run_plugin_sync_empty_executable_fails() {
        let manifest = crate::plugins::models::PluginManifest {
            name: "No Exec Plugin".to_string(),
            version: Some("1.0.0".to_string()),
            category: None,
            primary_output: None,
            description: None,
            plugin_type: "python".to_string(),
            executable: "".to_string(),
            module_name: None,
            inputs: vec![],
            needs: vec![],
            icon: None,
            properties: vec![],
            legacy_ids: vec![],
            plugin_dependencies: vec![],
            python_dependencies: vec![],
            pipeline: None,
        };
        let p = PluginInstance {
            id: "no_exec".to_string(),
            manifest,
            folder_path: "/dummy".to_string(),
            is_builtin: false,
            sdk_version: None,
        };

        let res = run_plugin_sync(p, "{}".to_string(), None, None, None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("does not specify an executable"));
    }
}
