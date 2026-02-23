pub mod options;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct Transform {
    pub x: f64,
    pub y: f64,
    pub yaw: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WaypointNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String, // "manual" or "generator"
    pub transform: Option<Transform>,
    pub options: Option<HashMap<String, serde_json::Value>>,
    pub generator_params: Option<HashMap<String, serde_json::Value>>,
    pub children_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MapInfo {
    pub image: String,
    pub resolution: f64,
    pub origin: [f64; 3],
    pub negate: i32,
    pub occupied_thresh: f64,
    pub free_thresh: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectMapLayer {
    pub id: String,
    pub name: String,
    pub info: Option<serde_json::Value>,
    pub image_base64: String,
    pub visible: bool,
    pub opacity: f64,
    pub z_index: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectData {
    pub root_node_ids: Vec<String>,
    pub nodes: HashMap<String, WaypointNode>,
    pub map_layers: Option<Vec<ProjectMapLayer>>,
}
