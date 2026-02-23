use crate::plugins::manager::PluginManager;
use crate::plugins::models::PluginInstance;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn fetch_installed_plugins(app: AppHandle) -> Result<Vec<PluginInstance>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find app_data_dir: {}", e))?;
        
    let manager = PluginManager::new(&app_data_dir);
    manager.scan_plugins()
}

#[tauri::command]
pub fn run_plugin(plugin_instance: PluginInstance, context_json: String) -> Result<Vec<serde_json::Value>, String> {
    // 【プラグイン・アーキテクチャの背景】
    // このツールでは、外部の経路生成アルゴリズム（PythonやWebAssembly）と連携するために、
    // セキュリティと拡張性、言語非依存性を重視し、「標準入出力ストリームを介したJSON通信」を採用しています。
    // プロセス間通信（IPC）にstdin/stdoutを用いることで、複雑なRPCライブラリを介さずとも
    // 開発者が使い慣れた言語で柔軟に拡張機能を作成できるよう設計されています。
    
    if plugin_instance.manifest.plugin_type == "python" {
        use std::process::{Command, Stdio};
        use std::io::Write;
        
        // Execute python script depending on OS
        let py_cmd = if cfg!(windows) { "python" } else { "python3" };

        let mut child = Command::new(py_cmd)
            .arg(&plugin_instance.manifest.executable)
            .current_dir(&plugin_instance.folder_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn python: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(context_json.as_bytes())
                .map_err(|e| format!("Failed to write to plugin stdin: {}", e))?;
        }

        let output = child.wait_with_output()
            .map_err(|e| format!("Failed to wait for python plugin: {}", e))?;

        if !output.status.success() {
            let err_str = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Plugin execution failed:\n{}", err_str));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        
        let waypoints: Vec<serde_json::Value> = serde_json::from_str(&stdout_str)
            .map_err(|e| format!("Failed to parse plugin output as JSON arrays: {}\nOutput was:\n{}", e, stdout_str))?;

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
