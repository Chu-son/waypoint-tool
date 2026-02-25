pub mod options;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize)]
pub struct Transform {
    pub x: f64,
    pub y: f64,
    pub z: Option<f64>,
    pub qx: f64,
    pub qy: f64,
    pub qz: f64,
    pub qw: f64,
}

// Custom deserializer to support older project files that only have `yaw`
impl<'de> Deserialize<'de> for Transform {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct RawTransform {
            x: f64,
            y: f64,
            z: Option<f64>,
            yaw: Option<f64>,
            qx: Option<f64>,
            qy: Option<f64>,
            qz: Option<f64>,
            qw: Option<f64>,
        }

        let raw = RawTransform::deserialize(deserializer)?;

        let (qx, qy, qz, qw) = if let (Some(qx), Some(qy), Some(qz), Some(qw)) = (raw.qx, raw.qy, raw.qz, raw.qw) {
            (qx, qy, qz, qw)
        } else if let Some(yaw) = raw.yaw {
            let half_yaw = yaw / 2.0;
            (0.0, 0.0, half_yaw.sin(), half_yaw.cos())
        } else {
            // Default to no rotation if both are missing
            (0.0, 0.0, 0.0, 1.0)
        };

        Ok(Transform {
            x: raw.x,
            y: raw.y,
            z: raw.z,
            qx,
            qy,
            qz,
            qw,
        })
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transform_deserialize_quaternion() {
        let json = r#"{"x": 1.0, "y": 2.0, "qx": 0.0, "qy": 0.0, "qz": 0.707, "qw": 0.707}"#;
        let t: Transform = serde_json::from_str(json).unwrap();
        assert_eq!(t.x, 1.0);
        assert_eq!(t.y, 2.0);
        assert!((t.qz - 0.707).abs() < 1e-6);
        assert!((t.qw - 0.707).abs() < 1e-6);
    }

    #[test]
    fn test_transform_deserialize_legacy_yaw() {
        let json = r#"{"x": 3.0, "y": 4.0, "yaw": 1.5707963}"#;
        let t: Transform = serde_json::from_str(json).unwrap();
        assert_eq!(t.x, 3.0);
        // yaw=π/2 → qz=sin(π/4)≈0.707, qw=cos(π/4)≈0.707
        assert!((t.qz - (1.5707963_f64 / 2.0).sin()).abs() < 1e-5);
        assert!((t.qw - (1.5707963_f64 / 2.0).cos()).abs() < 1e-5);
    }

    #[test]
    fn test_transform_deserialize_defaults() {
        let json = r#"{"x": 0.0, "y": 0.0}"#;
        let t: Transform = serde_json::from_str(json).unwrap();
        assert_eq!(t.qx, 0.0);
        assert_eq!(t.qy, 0.0);
        assert_eq!(t.qz, 0.0);
        assert_eq!(t.qw, 1.0);
    }

    #[test]
    fn test_waypoint_node_serialize_deserialize_roundtrip() {
        let node = WaypointNode {
            id: "wp-001".to_string(),
            node_type: "manual".to_string(),
            transform: Some(Transform { x: 10.0, y: 20.0, z: Some(0.5), qx: 0.0, qy: 0.0, qz: 0.0, qw: 1.0 }),
            options: None,
            generator_params: None,
            children_ids: Some(vec!["child-1".to_string()]),
        };
        let json = serde_json::to_string(&node).unwrap();
        let restored: WaypointNode = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.id, "wp-001");
        assert_eq!(restored.node_type, "manual");
        assert!(restored.transform.is_some());
        assert_eq!(restored.transform.as_ref().unwrap().x, 10.0);
        assert_eq!(restored.children_ids.as_ref().unwrap().len(), 1);
    }
}
