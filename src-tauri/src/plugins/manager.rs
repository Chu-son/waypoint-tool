use crate::plugins::models::{PluginManifest, PluginInstance};
use std::fs;
use std::path::{Path, PathBuf};

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
                            plugins.push(PluginInstance {
                                id,
                                manifest,
                                folder_path: path.to_string_lossy().to_string(),
                                is_builtin,
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
                                plugins.push(PluginInstance {
                                    id,
                                    manifest,
                                    folder_path: path.to_string_lossy().to_string(),
                                    is_builtin,
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
            let python_sdk_dir = res_dir.join("python_sdk");
            if python_sdk_dir.exists() {
                scan_dir(&python_sdk_dir, &mut plugins, true);
                scanned_builtin = true;
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
                        scan_dir(&dev_dir, &mut plugins, true);
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
}
