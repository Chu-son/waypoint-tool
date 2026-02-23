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
