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
    let main_py = format!(r#""""\n{} Plugin\n"""\nimport sys\nimport os\nimport math\n\nsys.path.append(os.path.dirname(__file__))\nfrom wpt_plugin import WaypointGenerator\n\n\nclass {}Generator(WaypointGenerator):\n    def generate(self, context):\n        start = self.get_interaction_data(context, "start_point")\n        if not start:\n            return []\n\n        base_x = float(start.get("x", 0.0))\n        base_y = float(start.get("y", 0.0))\n        yaw = self.quaternion_to_yaw(start)\n\n        count = int(self.get_property(context, "count", default=5))\n        spacing = float(self.get_property(context, "spacing", default=1.0))\n\n        waypoints = []\n        for i in range(count):\n            wx = base_x + i * spacing * math.cos(yaw)\n            wy = base_y + i * spacing * math.sin(yaw)\n            waypoints.append(self.make_waypoint(wx, wy, yaw))\n\n        self.log(f"Generated {{len(waypoints)}} waypoints.")\n        return waypoints\n\n\nif __name__ == "__main__":\n    {}Generator().run_from_stdin()\n"#,
        plugin_name,
        plugin_name.replace(" ", "").replace("-", "").replace("_", ""),
        plugin_name.replace(" ", "").replace("-", "").replace("_", ""),
    );

    std::fs::write(plugin_dir.join("main.py"), &main_py)
        .map_err(|e| format!("Failed to write main.py: {}", e))?;

    // Copy SDK (wpt_plugin.py) from bundled resources
    let sdk_content = find_bundled_sdk_content(&app)?;
    std::fs::write(plugin_dir.join("wpt_plugin.py"), &sdk_content)
        .map_err(|e| format!("Failed to write wpt_plugin.py SDK: {}", e))?;

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

/// Update the wpt_plugin.py in a plugin directory with the bundled version.
#[tauri::command]
pub fn update_plugin_sdk(app: AppHandle, plugin_folder_path: String) -> Result<String, String> {
    let sdk_content = find_bundled_sdk_content(&app)?;
    let target = std::path::Path::new(&plugin_folder_path).join("wpt_plugin.py");
    std::fs::write(&target, &sdk_content)
        .map_err(|e| format!("Failed to write SDK: {}", e))?;

    // Return the new version
    detect_sdk_version(std::path::Path::new(&plugin_folder_path))
        .ok_or_else(|| "SDK was written but version could not be read back.".to_string())
}

/// Find and read the content of the bundled wpt_plugin.py SDK file.
fn find_bundled_sdk_content(app: &AppHandle) -> Result<String, String> {
    // Try resource_dir (bundled app)
    if let Ok(res_dir) = app.path().resource_dir() {
        let sdk_path = res_dir.join("python_sdk").join("wpt_plugin.py");
        if sdk_path.exists() {
            return std::fs::read_to_string(&sdk_path)
                .map_err(|e| format!("Failed to read bundled SDK: {}", e));
        }
    }
    // Fallback for development environment
    if let Ok(current_dir) = std::env::current_dir() {
        for path in &[
            current_dir.join("../python_sdk/wpt_plugin.py"),
            current_dir.join("python_sdk/wpt_plugin.py"),
        ] {
            let resolved = path.canonicalize().unwrap_or(path.clone());
            if resolved.exists() {
                return std::fs::read_to_string(&resolved)
                    .map_err(|e| format!("Failed to read SDK: {}", e));
            }
        }
    }
    Err("Could not find bundled wpt_plugin.py SDK.".to_string())
}

#[tauri::command]
pub fn run_plugin(plugin_instance: PluginInstance, context_json: String, python_path: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    // 【プラグイン・アーキテクチャの背景】
    // このツールでは、外部の経路生成アルゴリズム（PythonやWebAssembly）と連携するために、
    // セキュリティと拡張性、言語非依存性を重視し、「標準入出力ストリームを介したJSON通信」を採用しています。
    // プロセス間通信（IPC）にstdin/stdoutを用いることで、複雑なRPCライブラリを介さずとも
    // 開発者が使い慣れた言語で柔軟に拡張機能を作成できるよう設計されています。
    
    if plugin_instance.manifest.plugin_type == "python" {
        use std::process::{Command, Stdio};
        use std::io::Write;
        
        let default_cmd = if cfg!(windows) { "python".to_string() } else { "python3".to_string() };
        let py_cmd = match python_path {
            Some(p) if !p.trim().is_empty() => p.trim().to_string(),
            _ => default_cmd,
        };
        
        println!("[DEBUG/RUST] Executing plugin: {} with cmd: {}", plugin_instance.manifest.executable, py_cmd);
        println!("[DEBUG/RUST] Using Context JSON: {}", context_json);

        let child_res = Command::new(&py_cmd)
            .arg(&plugin_instance.manifest.executable)
            .current_dir(&plugin_instance.folder_path)
            .env_remove("PYTHONPATH")
            .env_remove("PYTHONHOME")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        let mut child = match child_res {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound && py_cmd == "python" && !cfg!(windows) => {
                println!("[DEBUG/RUST] 'python' command not found. Falling back to 'python3'...");
                Command::new("python3")
                    .arg(&plugin_instance.manifest.executable)
                    .current_dir(&plugin_instance.folder_path)
                    .env_remove("PYTHONPATH")
                    .env_remove("PYTHONHOME")
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e2| format!("Failed to spawn python (also tried python3): {}", e2))?
            }
            Err(e) => return Err(format!("Failed to spawn python ({}): {}", py_cmd, e)),
        };

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(context_json.as_bytes())
                .map_err(|e| format!("Failed to write to plugin stdin: {}", e))?;
        }

        let output = child.wait_with_output()
            .map_err(|e| format!("Failed to wait for python plugin: {}", e))?;

        if !output.status.success() {
            let err_str = String::from_utf8_lossy(&output.stderr);
            println!("[DEBUG/RUST] Execution Failed stderror:\n{}", err_str);
            return Err(format!("Plugin execution failed:\n{}", err_str));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        println!("[DEBUG/RUST] Execution Success stdout:\n{}", stdout_str);
        
        let waypoints: Vec<serde_json::Value> = serde_json::from_str(&stdout_str)
            .map_err(|e| {
                println!("[DEBUG/RUST] JSON Parse Error: {}", e);
                format!("Failed to parse plugin output as JSON arrays: {}\nOutput was:\n{}", e, stdout_str)
            })?;

        Ok(waypoints)
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
