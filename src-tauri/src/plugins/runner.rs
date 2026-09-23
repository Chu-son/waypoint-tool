//! Running a plugin process (Python / WASM) and exchanging JSON over stdio.
use crate::plugins::manager::PluginManager;
use crate::plugins::models::PluginInstance;
use crate::plugins::sdk::find_bundled_sdk_path;
use tauri::{AppHandle, Manager};

/// Filter plugins of type `python_library` or having `module_name` set, and return deduplicated folder paths.
pub fn collect_python_library_paths_from_plugins(plugins: &[PluginInstance]) -> Vec<std::path::PathBuf> {
    let mut paths = Vec::new();
    for p in plugins {
        let has_module = p.manifest.module_name.as_ref().is_some_and(|m| !m.trim().is_empty());
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
            for dev_dir in &[current_dir.join("../python_sdk"), current_dir.join("python_sdk")] {
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
        for dev_path in &[current_dir.join("../python_sdk"), current_dir.join("python_sdk")] {
            let resolved = dev_path.canonicalize().unwrap_or_else(|_| dev_path.clone());
            if resolved.join("wpt_plugin").exists() && !paths.contains(&resolved) {
                paths.push(resolved);
            }
        }
    }

    paths
}

pub const PAYLOAD_FILE_REF_KEY: &str = "__wpt_payload_ref__";
pub const PAYLOAD_OFFLOAD_THRESHOLD_BYTES: usize = 256 * 1024; // 256 KB

pub fn safe_log_snippet(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{} ... [truncated, total {} bytes]", &s[..max_len], s.len())
    }
}

pub fn validate_payload_temp_path(file_ref: &str) -> Result<std::path::PathBuf, String> {
    let path = std::path::Path::new(file_ref);
    if !path.exists() || !path.is_file() {
        return Err(format!(
            "Payload file does not exist or is not a regular file: {}",
            file_ref
        ));
    }

    // 1. Validate file name pattern: must start with 'wpt_out_' and end with '.json'
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid file name in payload reference".to_string())?;

    if !file_name.starts_with("wpt_out_") || !file_name.ends_with(".json") {
        return Err(format!(
            "Security Error: Payload file name does not match expected pattern (wpt_out_*.json): {}",
            file_name
        ));
    }

    // 2. Validate directory boundary: must be located inside OS temp directory
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize payload path: {}", e))?;
    let canonical_temp = std::env::temp_dir()
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize temp directory: {}", e))?;

    if !canonical_path.starts_with(&canonical_temp) {
        return Err(format!(
            "Security Error: Payload file is located outside temporary directory: {:?}",
            canonical_path
        ));
    }

    Ok(canonical_path)
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

        let default_cmd = if cfg!(windows) {
            "python".to_string()
        } else {
            "python3".to_string()
        };
        let py_cmd = match python_path {
            Some(p) if !p.trim().is_empty() => p.trim().to_string(),
            _ => default_cmd,
        };

        // Construct clean safe PYTHONPATH containing all scanned python_library plugins
        let library_paths = collect_python_library_paths(app);
        let safe_python_path = build_safe_python_path(&library_paths);

        println!(
            "[DEBUG/RUST] Executing plugin: {} with cmd: {}",
            plugin_instance.manifest.executable, py_cmd
        );
        println!(
            "[DEBUG/RUST] Using Context JSON: {}",
            safe_log_snippet(&context_json, 512)
        );
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

        let mut context: serde_json::Value =
            serde_json::from_str(&context_json).map_err(|e| format!("Failed to parse context_json: {}", e))?;

        let needs = &plugin_instance.manifest.needs;
        let needs_grid = needs
            .iter()
            .any(|n| n == "occupancy_grid" || n == "occupancy_grid_in_region");

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

        let enriched_json =
            serde_json::to_string(&context).map_err(|e| format!("Failed to serialize context: {}", e))?;

        let mut _in_temp_file = None;
        let final_stdin_bytes = if enriched_json.len() >= PAYLOAD_OFFLOAD_THRESHOLD_BYTES {
            // Offload large input context to temp file
            let mut temp_file = tempfile::Builder::new()
                .prefix("wpt_in_")
                .suffix(".json")
                .tempfile()
                .map_err(|e| format!("Failed to create input temp file: {}", e))?;

            use std::io::Write;
            temp_file
                .write_all(enriched_json.as_bytes())
                .map_err(|e| format!("Failed to write input temp file: {}", e))?;
            temp_file
                .flush()
                .map_err(|e| format!("Failed to flush input temp file: {}", e))?;

            let temp_path = temp_file.path().to_string_lossy().to_string();
            println!(
                "[DEBUG/RUST] Context size ({} bytes) exceeds threshold. Offloaded to temp file: {}",
                enriched_json.len(),
                temp_path
            );

            let ref_obj = serde_json::json!({
                PAYLOAD_FILE_REF_KEY: temp_path
            });
            _in_temp_file = Some(temp_file);
            ref_obj.to_string().into_bytes()
        } else {
            enriched_json.into_bytes()
        };

        let stdin_handle = child.stdin.take().map(|mut stdin| {
            std::thread::spawn(move || {
                use std::io::Write;
                let _ = stdin.write_all(&final_stdin_bytes);
            })
        });

        let output = child
            .wait_with_output()
            .map_err(|e| format!("Failed to wait for python plugin: {}", e))?;

        if let Some(handle) = stdin_handle {
            let _ = handle.join();
        }

        // Ensure input temp file is dropped and removed
        drop(_in_temp_file);

        if !output.status.success() {
            let err_str = String::from_utf8_lossy(&output.stderr);
            println!(
                "[DEBUG/RUST] Execution Failed stderr:\n{}",
                safe_log_snippet(&err_str, 1024)
            );
            return Err(format!("Plugin execution failed:\n{}", err_str));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        println!(
            "[DEBUG/RUST] Execution Success stdout: {}",
            safe_log_snippet(&stdout_str, 512)
        );
        if !stderr_str.trim().is_empty() {
            println!(
                "[DEBUG/RUST] Execution Success stderr: {}",
                safe_log_snippet(&stderr_str, 512)
            );
        }

        let trimmed_stdout = stdout_str.trim();
        let parsed_initial: serde_json::Value = serde_json::from_str(trimmed_stdout).map_err(|e| {
            println!("[DEBUG/RUST] JSON Parse Error: {}", e);
            format!(
                "Failed to parse plugin output as JSON: {}\nOutput was:\n{}",
                e,
                safe_log_snippet(trimmed_stdout, 1024)
            )
        })?;

        // Check if stdout returned a temp file reference payload
        let result = if let Some(file_ref) = parsed_initial.get(PAYLOAD_FILE_REF_KEY).and_then(|v| v.as_str()) {
            let valid_path = validate_payload_temp_path(file_ref)?;
            println!("[DEBUG/RUST] Loading offloaded result from temp file: {:?}", valid_path);
            let content = std::fs::read_to_string(&valid_path)
                .map_err(|e| format!("Failed to read payload file {:?}: {}", valid_path, e))?;

            // Cleanup the temp file safely
            let _ = std::fs::remove_file(&valid_path);

            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse offloaded payload from {:?}: {}", valid_path, e))?
        } else {
            parsed_initial
        };

        Ok(result)
    } else if plugin_instance.manifest.plugin_type == "wasm" {
        let wasm_file = std::path::Path::new(&plugin_instance.folder_path).join(&plugin_instance.manifest.executable);

        crate::plugins::wasm_runner::run_wasm_plugin(wasm_file.to_str().unwrap(), &context_json)
    } else {
        Err("Unsupported plugin type. Only 'python' and 'wasm' are currently supported.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

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

    #[test]
    fn test_safe_log_snippet() {
        let short_str = "hello world";
        assert_eq!(safe_log_snippet(short_str, 50), "hello world");

        let long_str = "a".repeat(100);
        let snippet = safe_log_snippet(&long_str, 10);
        assert!(snippet.contains("... [truncated, total 100 bytes]"));
        assert!(snippet.starts_with("aaaaaaaaaa"));
    }

    #[test]
    fn test_run_plugin_sync_resolves_temp_file_ref_and_cleans_up() {
        let tmp = TempDir::new().unwrap();
        let plugin_dir = tmp.path().join("test_file_ref_plugin");
        fs::create_dir_all(&plugin_dir).unwrap();

        let manifest = r#"{
            "name": "File Ref Test",
            "type": "python",
            "executable": "main.py",
            "inputs": [],
            "properties": []
        }"#;
        fs::write(plugin_dir.join("manifest.json"), manifest).unwrap();

        // Python script that creates a temp file with large payload and returns __wpt_payload_ref__
        let py_script = r#"
import sys
import json
import tempfile

with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".json", prefix="wpt_out_", encoding="utf-8") as f:
    json.dump({"result_key": "large_value_success", "waypoints": [{"x": 1.0, "y": 2.0}]}, f)
    temp_path = f.name

print(json.dumps({"__wpt_payload_ref__": temp_path}))
"#;
        fs::write(plugin_dir.join("main.py"), py_script).unwrap();

        let p = crate::plugins::manager::load_plugin_dir(&plugin_dir, false).unwrap();
        let res = run_plugin_sync(p, "{}".to_string(), None, None, None);
        assert!(res.is_ok(), "Expected run_plugin_sync to succeed, got: {:?}", res.err());

        let val = res.unwrap();
        assert_eq!(val["result_key"], "large_value_success");
        assert_eq!(val["waypoints"][0]["x"], 1.0);
    }

    #[test]
    fn test_validate_payload_temp_path_rejects_outside_temp_dir() {
        let current_dir = std::env::current_dir().unwrap();
        let outside_file = current_dir.join("wpt_out_outside_test.json");
        fs::write(&outside_file, "{}").unwrap();

        let res = validate_payload_temp_path(outside_file.to_str().unwrap());
        let _ = fs::remove_file(&outside_file);

        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Security Error"));
    }

    #[test]
    fn test_validate_payload_temp_path_rejects_invalid_file_name() {
        let temp_dir = std::env::temp_dir();
        let invalid_file = temp_dir.join("not_wpt_out_malicious.json");
        fs::write(&invalid_file, "{}").unwrap();

        let res = validate_payload_temp_path(invalid_file.to_str().unwrap());
        let _ = fs::remove_file(&invalid_file);

        assert!(res.is_err());
        assert!(res
            .unwrap_err()
            .contains("Security Error: Payload file name does not match expected pattern"));
    }
}
