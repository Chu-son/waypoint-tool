use crate::plugins::models::{PluginManifest, PluginInstance};
use std::fs;
use std::path::{Path, PathBuf};

/// Read the `__version__` string from a `wpt_plugin.py` file in the given plugin directory.
/// Returns `None` if the file doesn't exist or the version line isn't found.
pub fn detect_sdk_version(plugin_dir: &Path) -> Option<String> {
    let sdk_path = plugin_dir.join("wpt_plugin.py");
    let content = fs::read_to_string(&sdk_path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("__version__") {
            // Parse: __version__ = "1.1.0" or __version__ = '1.1.0'
            if let Some(eq_pos) = trimmed.find('=') {
                let value = trimmed[eq_pos + 1..].trim();
                let version = value.trim_matches(|c| c == '"' || c == '\'');
                if !version.is_empty() {
                    return Some(version.to_string());
                }
            }
        }
    }
    None
}

/// Read the bundled SDK version from the resource directory or development fallback.
pub fn get_bundled_sdk_version(resource_dir: Option<&Path>) -> Option<String> {
    // Try resource_dir/python_sdk/wpt_plugin.py first
    if let Some(res_dir) = resource_dir {
        let sdk_path = res_dir.join("python_sdk");
        if let Some(v) = detect_sdk_version(&sdk_path) {
            return Some(v);
        }
    }
    // Fallback for development environment
    if let Ok(current_dir) = std::env::current_dir() {
        for path in &[
            current_dir.join("../python_sdk"),
            current_dir.join("python_sdk"),
        ] {
            let resolved = path.canonicalize().unwrap_or(path.clone());
            if let Some(v) = detect_sdk_version(&resolved) {
                return Some(v);
            }
        }
    }
    None
}

pub struct PluginManager {
    plugins_dir: PathBuf,
    resource_dir: Option<PathBuf>,
}

impl PluginManager {
    /// Scan a single directory for plugins (public for testing).
    pub fn scan_plugins_in_dir(dir: &Path, is_builtin: bool) -> Vec<PluginInstance> {
        let mut plugins = Vec::new();
        if !dir.exists() {
            return plugins;
        }
        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return plugins,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    if let Ok(content) = fs::read_to_string(&manifest_path) {
                        if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                            let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                            let sdk_version = detect_sdk_version(&path);
                            plugins.push(PluginInstance {
                                id,
                                manifest,
                                folder_path: path.to_string_lossy().to_string(),
                                is_builtin,
                                sdk_version,
                            });
                        }
                    }
                }
            }
        }
        plugins
    }

    pub fn new(app_data_dir: &Path, resource_dir: Option<PathBuf>) -> Self {
        let plugins_dir = app_data_dir.join("plugins");
        if !plugins_dir.exists() {
            let _ = fs::create_dir_all(&plugins_dir);
        }
        Self { plugins_dir, resource_dir }
    }

    pub fn scan_plugins(&self) -> Result<Vec<PluginInstance>, String> {
        let mut plugins = Vec::new();

        // Helper function to scan a directory
        let scan_dir = |dir: &Path, plugins: &mut Vec<PluginInstance>, is_builtin: bool| {
            if !dir.exists() {
                return;
            }

            let entries = match fs::read_dir(dir) {
                Ok(entries) => entries,
                Err(_) => return,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let manifest_path = path.join("manifest.json");
                    if manifest_path.exists() {
                        if let Ok(content) = fs::read_to_string(&manifest_path) {
                            if let Ok(manifest) = serde_json::from_str::<PluginManifest>(&content) {
                                let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                                let sdk_version = detect_sdk_version(&path);
                                plugins.push(PluginInstance {
                                    id,
                                    manifest,
                                    folder_path: path.to_string_lossy().to_string(),
                                    is_builtin,
                                    sdk_version,
                                });
                            }
                        }
                    }
                }
            }
        };

        // Scan user plugins
        scan_dir(&self.plugins_dir, &mut plugins, false);

        // Scan built-in plugins in resource_dir/python_sdk
        let mut scanned_builtin = false;
        if let Some(res_dir) = &self.resource_dir {
            // Try common resource paths. Tauri v2 often nests ../ paths under _up_ prefix.
            let candidates = vec![
                res_dir.join("python_sdk"),
                res_dir.join("_up_").join("python_sdk"),
                res_dir.join("_up_").join("_up_").join("python_sdk"),
            ];

            for python_sdk_dir in candidates {
                if python_sdk_dir.exists() {
                    println!("[DEBUG/RUST] Found bundled python_sdk at: {:?}", python_sdk_dir);
                    plugins.extend(Self::scan_plugins_in_dir(&python_sdk_dir, true));
                    scanned_builtin = true;
                    break;
                }
            }
        }

        // AppImage fallback for Linux
        if !scanned_builtin && cfg!(target_os = "linux") {
            if let Ok(appdir) = std::env::var("APPDIR") {
                let appdir_path = Path::new(&appdir);
                // In AppImage, resources are usually in usr/lib/<product>/resources
                let candidates = vec![
                    appdir_path.join("usr").join("lib").join("waypoint-tool").join("resources").join("python_sdk"),
                    appdir_path.join("usr").join("bin").join("resources").join("python_sdk"),
                ];
                for python_sdk_dir in candidates {
                    if python_sdk_dir.exists() {
                        println!("[DEBUG/RUST] Found AppImage python_sdk at: {:?}", python_sdk_dir);
                        plugins.extend(Self::scan_plugins_in_dir(&python_sdk_dir, true));
                        scanned_builtin = true;
                        break;
                    }
                }
            }
        }

        // Fallback for development environment where resource_dir might not be bundled yet
        // Try relative to current working directory (e.g. `src-tauri` or project root)
        if !scanned_builtin {
            if let Ok(current_dir) = std::env::current_dir() {
                let paths_to_try = vec![
                    current_dir.join("../python_sdk"), // If cwd is src-tauri
                    current_dir.join("python_sdk"),    // If cwd is the project root
                ];
                for dev_dir in paths_to_try {
                    let dev_dir = dev_dir.canonicalize().unwrap_or(dev_dir);
                    if dev_dir.exists() && dev_dir.is_dir() {
                        println!("[DEBUG/RUST] Found development python_sdk at: {:?}", dev_dir);
                        plugins.extend(Self::scan_plugins_in_dir(&dev_dir, true));
                        scanned_builtin = true;
                        break;
                    }
                }
                // Also scan rust_plugins directory
                let rust_paths_to_try = vec![
                    current_dir.join("../rust_plugins"), // If cwd is src-tauri
                    current_dir.join("rust_plugins"),    // If cwd is the project root
                ];
                for dev_dir in rust_paths_to_try {
                    let dev_dir = dev_dir.canonicalize().unwrap_or(dev_dir);
                    if dev_dir.exists() && dev_dir.is_dir() {
                        scan_dir(&dev_dir, &mut plugins, true);
                        break;
                    }
                }
            }
        }

        Ok(plugins)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_plugin(dir: &std::path::Path, name: &str, manifest_json: &str) {
        let plugin_dir = dir.join(name);
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join("manifest.json"), manifest_json).unwrap();
    }

    #[test]
    fn test_scan_empty_directory() {
        let tmp = TempDir::new().unwrap();
        let plugins = PluginManager::scan_plugins_in_dir(tmp.path(), true);
        assert!(plugins.is_empty());
    }

    #[test]
    fn test_scan_detects_plugin_with_manifest() {
        let tmp = TempDir::new().unwrap();
        let manifest = r#"{
            "name": "Test Plugin",
            "type": "python",
            "executable": "main.py",
            "inputs": [],
            "properties": []
        }"#;
        create_test_plugin(tmp.path(), "test_plugin", manifest);

        let plugins = PluginManager::scan_plugins_in_dir(tmp.path(), false);
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].manifest.name, "Test Plugin");
        assert!(!plugins[0].is_builtin);
    }

    #[test]
    fn test_scan_skips_dir_without_manifest() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("no_manifest_dir")).unwrap();
        fs::write(tmp.path().join("no_manifest_dir/main.py"), "# empty").unwrap();

        let plugins = PluginManager::scan_plugins_in_dir(tmp.path(), true);
        assert!(plugins.is_empty());
    }

    #[test]
    fn test_scan_skips_invalid_json_manifest() {
        let tmp = TempDir::new().unwrap();
        create_test_plugin(tmp.path(), "broken", "{ not valid json }");

        let plugins = PluginManager::scan_plugins_in_dir(tmp.path(), true);
        assert!(plugins.is_empty());
    }

    #[test]
    fn test_detect_sdk_version_reads_version() {
        let tmp = TempDir::new().unwrap();
        let sdk_content = "__version__ = \"1.1.0\"\n# rest of SDK\n";
        fs::write(tmp.path().join("wpt_plugin.py"), sdk_content).unwrap();

        let version = detect_sdk_version(tmp.path());
        assert_eq!(version, Some("1.1.0".to_string()));
    }

    #[test]
    fn test_detect_sdk_version_missing_file() {
        let tmp = TempDir::new().unwrap();
        let version = detect_sdk_version(tmp.path());
        assert!(version.is_none());
    }

    #[test]
    fn test_scan_populates_sdk_version() {
        let tmp = TempDir::new().unwrap();
        let plugin_dir = tmp.path().join("my_plugin");
        fs::create_dir_all(&plugin_dir).unwrap();
        fs::write(plugin_dir.join("manifest.json"), r#"{"name":"P","type":"python","executable":"main.py"}"#).unwrap();
        fs::write(plugin_dir.join("wpt_plugin.py"), "__version__ = '2.0.0'\n").unwrap();

        let plugins = PluginManager::scan_plugins_in_dir(tmp.path(), false);
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].sdk_version, Some("2.0.0".to_string()));
    }
}
