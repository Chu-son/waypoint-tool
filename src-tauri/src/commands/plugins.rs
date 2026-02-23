use crate::plugins::manager::PluginManager;
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

    Ok(PluginInstance {
        id,
        manifest,
        folder_path: p.to_string_lossy().to_string(),
        is_builtin: false,
    })
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
