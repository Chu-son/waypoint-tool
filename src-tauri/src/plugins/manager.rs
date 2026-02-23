use crate::plugins::models::{PluginManifest, PluginInstance};
use std::fs;
use std::path::{Path, PathBuf};

pub struct PluginManager {
    plugins_dir: PathBuf,
}

impl PluginManager {
    pub fn new(app_data_dir: &Path) -> Self {
        let plugins_dir = app_data_dir.join("plugins");
        if !plugins_dir.exists() {
            let _ = fs::create_dir_all(&plugins_dir);
        }
        Self { plugins_dir }
    }

    pub fn scan_plugins(&self) -> Result<Vec<PluginInstance>, String> {
        let mut plugins = Vec::new();

        if !self.plugins_dir.exists() {
            return Ok(plugins);
        }

        let entries = match fs::read_dir(&self.plugins_dir) {
            Ok(entries) => entries,
            Err(e) => return Err(format!("Failed to read plugins directory: {}", e)),
        };

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    let manifest_path = path.join("manifest.json");
                    if manifest_path.exists() {
                        match fs::read_to_string(&manifest_path) {
                            Ok(content) => {
                                match serde_json::from_str::<PluginManifest>(&content) {
                                    Ok(manifest) => {
                                        // Use folder name as plugin ID
                                        let id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                                        
                                        plugins.push(PluginInstance {
                                            id,
                                            manifest,
                                            folder_path: path.to_string_lossy().to_string(),
                                        });
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to parse manifest in {:?}: {}", manifest_path, e);
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to read manifest file {:?}: {}", manifest_path, e);
                            }
                        }
                    }
                }
            }
        }

        Ok(plugins)
    }
}
