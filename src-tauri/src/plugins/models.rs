use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PluginInputType {
    Point,
    Rectangle,
    Polygon,
    Path,
    NodeSelect,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginInputDef {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub input_type: PluginInputType,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginManifest {
    pub name: String,
    pub version: Option<String>,
    #[serde(rename = "type")]
    pub plugin_type: String, // "python" or "wasm"
    pub executable: String,
    #[serde(default)]
    pub inputs: Vec<PluginInputDef>,
    #[serde(default)]
    pub needs: Vec<String>,
    #[serde(default)]
    pub properties: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginInstance {
    pub id: String,
    pub manifest: PluginManifest,
    pub folder_path: String,
    pub is_builtin: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_python_manifest_deserialize() {
        let json = r#"{
            "name": "Sweep Generator",
            "type": "python",
            "executable": "main.py",
            "inputs": [{"id": "start_point", "type": "point", "label": "Start"}],
            "properties": [{"name": "pitch", "label": "Pitch", "type": "float", "default": 1.0}],
            "needs": ["transform"]
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Sweep Generator");
        assert_eq!(manifest.plugin_type, "python");
        assert_eq!(manifest.inputs.len(), 1);
        assert_eq!(manifest.properties.len(), 1);
        assert_eq!(manifest.needs.len(), 1);
    }

    #[test]
    fn test_wasm_manifest_deserialize() {
        let json = r#"{
            "name": "WASM Plugin",
            "type": "wasm",
            "executable": "plugin.wasm",
            "inputs": [],
            "properties": []
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.plugin_type, "wasm");
        assert_eq!(manifest.executable, "plugin.wasm");
    }

    #[test]
    fn test_manifest_defaults_empty_arrays() {
        let json = r#"{
            "name": "Minimal",
            "type": "python",
            "executable": "run.py"
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert!(manifest.inputs.is_empty());
        assert!(manifest.properties.is_empty());
        assert!(manifest.needs.is_empty());
    }
}

