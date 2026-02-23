use std::fs;
use crate::models::ProjectData;
use handlebars::Handlebars;

pub fn save_project(path: &str, data: &ProjectData) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Serialization error: {}", e))?;
    
    fs::write(path, json)
        .map_err(|e| format!("File write error: {}", e))?;
    
    Ok(())
}

pub fn load_project(path: &str) -> Result<ProjectData, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("File read error: {}", e))?;
    
    let data: ProjectData = serde_json::from_str(&content)
        .map_err(|e| format!("Deserialization error: {}", e))?;
    
    Ok(data)
}

use base64::{engine::general_purpose, Engine as _};
use std::path::Path;

pub fn export_waypoints(path: &str, waypoints: Vec<serde_json::Value>, template: Option<String>, image_data_b64: Option<String>) -> Result<(), String> {
    let content = if let Some(tmpl) = template {
        let reg = Handlebars::new();
        // Register the template string and render it with wrapped data
        let rendered = reg.render_template(&tmpl, &serde_json::json!({ "waypoints": waypoints }))
            .map_err(|e| format!("Template render error: {}", e))?;
        rendered
    } else if path.to_lowercase().ends_with(".yaml") || path.to_lowercase().ends_with(".yml") {
        serde_yaml::to_string(&waypoints)
            .map_err(|e| format!("YAML serialization error: {}", e))?
    } else {
        serde_json::to_string_pretty(&waypoints)
            .map_err(|e| format!("JSON serialization error: {}", e))?
    };

    fs::write(path, content)
        .map_err(|e| format!("File write error: {}", e))?;

    // Export image if provided
    if let Some(b64) = image_data_b64 {
        let decoded = general_purpose::STANDARD.decode(b64)
            .map_err(|e| format!("Base64 decode error: {}", e))?;
            
        let path_obj = Path::new(path);
        let png_path = path_obj.with_extension("png");
        fs::write(&png_path, decoded).map_err(|e| format!("Image write error: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn test_export_waypoints_with_template() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("out.txt");
        let path_str = file_path.to_str().unwrap();

        let waypoints = vec![
            json!({ "id": "wp1", "x": 10.0, "y": 20.0, "qx": 0.0, "qy": 0.0, "qz": 0.0, "qw": 1.0 }),
            json!({ "id": "wp2", "x": -5.5, "y": 3.2, "qx": 0.0, "qy": 0.0, "qz": 0.707, "qw": 0.707 }),
        ];

        let template = Some("{{#each waypoints}}Node {{id}} is at {{x}}, {{y}}\n{{/each}}".to_string());
        
        // Use temp file for export
        let res = export_waypoints(path_str, waypoints, template, None);
        assert!(res.is_ok(), "Export failed: {:?}", res.err());

        // Read and verify
        let content = fs::read_to_string(path_str).unwrap();
        assert!(content.contains("Node wp1 is at 10.0, 20.0"));
        assert!(content.contains("Node wp2 is at -5.5, 3.2"));
    }

    #[test]
    fn test_export_waypoints_json_fallback() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("out.json");
        let path_str = file_path.to_str().unwrap();

        let waypoints = vec![json!({ "id": "wp1" })];
        
        let res = export_waypoints(path_str, waypoints, None, None);
        assert!(res.is_ok(), "Export failed");

        let content = fs::read_to_string(path_str).unwrap();
        assert!(content.contains("\"id\": \"wp1\""));
    }

    #[test]
    fn test_save_and_load_project() {
        use crate::models::{WaypointNode, Transform};
        use std::collections::HashMap;

        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_project.wptroj");
        let path_str = file_path.to_str().unwrap();

        let mut nodes = HashMap::new();
        nodes.insert(
            "node1".to_string(),
            WaypointNode {
                id: "node1".to_string(),
                node_type: "manual".to_string(),
                transform: Some(Transform { x: 1.0, y: 2.0, z: None, qx: 0.0, qy: 0.0, qz: 0.0, qw: 1.0 }),
                options: None,
                generator_params: None,
                children_ids: None,
            },
        );

        let project_data = ProjectData {
            root_node_ids: vec!["node1".to_string()],
            nodes,
            map_layers: None,
        };

        // Save
        let save_res = save_project(path_str, &project_data);
        assert!(save_res.is_ok(), "Save project failed");

        // Load
        let load_res = load_project(path_str);
        assert!(load_res.is_ok(), "Load project failed");

        let loaded_data = load_res.unwrap();
        assert_eq!(loaded_data.root_node_ids, vec!["node1".to_string()]);
        assert!(loaded_data.nodes.contains_key("node1"));
        let node = loaded_data.nodes.get("node1").unwrap();
        assert_eq!(node.id, "node1");
        assert_eq!(node.node_type, "manual");
        assert_eq!(node.transform.as_ref().unwrap().x, 1.0);
        assert_eq!(node.transform.as_ref().unwrap().y, 2.0);
        assert_eq!(node.transform.as_ref().unwrap().qx, 0.0);
        assert_eq!(node.transform.as_ref().unwrap().qy, 0.0);
        assert_eq!(node.transform.as_ref().unwrap().qz, 0.0);
        assert_eq!(node.transform.as_ref().unwrap().qw, 1.0);
    }
}
