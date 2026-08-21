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

pub fn import_waypoints(path: &str) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("File read error: {}", e))?;

    if path.to_lowercase().ends_with(".json") {
        serde_json::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("JSON parse error: {}", e))
    } else {
        serde_yaml::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("YAML parse error: {}", e))
    }
}

// Handlebarsのエクスポートテンプレートを1件分のダミーデータでレンダリングし、
// 出力されたJSON/YAML内で各フィールドがどのドットパスに現れるかを逆算してImportFieldMappingを推定する。
const SENTINEL_X: f64 = -910114.111111;
const SENTINEL_Y: f64 = -910114.222222;
const SENTINEL_Z: f64 = -910114.333333;
const SENTINEL_YAW: f64 = -910114.444444;
const SENTINEL_QX: f64 = -910114.555555;
const SENTINEL_QY: f64 = -910114.666666;
const SENTINEL_QZ: f64 = -910114.777777;
const SENTINEL_QW: f64 = -910114.888888;

fn find_path_for_number(value: &serde_json::Value, target: f64, prefix: &str) -> Option<String> {
    match value {
        serde_json::Value::Number(n) => {
            let f = n.as_f64()?;
            if (f - target).abs() < 1e-6 {
                Some(prefix.trim_start_matches('.').to_string())
            } else {
                None
            }
        }
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                let new_prefix = format!("{}.{}", prefix, k);
                if let Some(p) = find_path_for_number(v, target, &new_prefix) {
                    return Some(p);
                }
            }
            None
        }
        serde_json::Value::Array(arr) => {
            for (i, v) in arr.iter().enumerate() {
                let new_prefix = format!("{}.{}", prefix, i);
                if let Some(p) = find_path_for_number(v, target, &new_prefix) {
                    return Some(p);
                }
            }
            None
        }
        _ => None,
    }
}

// 要素数1の配列で、その要素がオブジェクトであるものを「waypoints配列」とみなして探索する。
fn find_items_array(value: &serde_json::Value, prefix: &str) -> Option<(String, serde_json::Value)> {
    match value {
        serde_json::Value::Array(arr) if arr.len() == 1 && arr[0].is_object() => {
            Some((prefix.trim_start_matches('.').to_string(), arr[0].clone()))
        }
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                let new_prefix = format!("{}.{}", prefix, k);
                if let Some(res) = find_items_array(v, &new_prefix) {
                    return Some(res);
                }
            }
            None
        }
        serde_json::Value::Array(arr) => {
            for (i, v) in arr.iter().enumerate() {
                let new_prefix = format!("{}.{}", prefix, i);
                if let Some(res) = find_items_array(v, &new_prefix) {
                    return Some(res);
                }
            }
            None
        }
        _ => None,
    }
}

pub fn infer_import_mapping(template: &str) -> Result<serde_json::Value, String> {
    let waypoint = serde_json::json!({
        "index": 0,
        "id": "__WPT_ID_SENTINEL__",
        "type": "manual",
        "x": SENTINEL_X,
        "y": SENTINEL_Y,
        "z": SENTINEL_Z,
        "yaw": SENTINEL_YAW,
        "qx": SENTINEL_QX,
        "qy": SENTINEL_QY,
        "qz": SENTINEL_QZ,
        "qw": SENTINEL_QW,
        "options": {}
    });

    let reg = Handlebars::new();
    let rendered = reg
        .render_template(template, &serde_json::json!({ "waypoints": [waypoint] }))
        .map_err(|e| format!("Template render error: {}", e))?;

    let parsed: serde_json::Value = serde_json::from_str(&rendered)
        .or_else(|_| serde_yaml::from_str::<serde_json::Value>(&rendered))
        .map_err(|_| "テンプレートの出力が構造化データ(YAML/JSON)として解析できませんでした。".to_string())?;

    let (items_path, item_value) = find_items_array(&parsed, "")
        .ok_or_else(|| "テンプレート出力からウェイポイント配列を検出できませんでした。".to_string())?;

    let mut mapping = serde_json::Map::new();
    mapping.insert("itemsPath".to_string(), serde_json::Value::String(items_path));

    let x_path = find_path_for_number(&item_value, SENTINEL_X, "");
    let y_path = find_path_for_number(&item_value, SENTINEL_Y, "");
    if let Some(p) = x_path.clone() {
        mapping.insert("x".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = y_path.clone() {
        mapping.insert("y".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = find_path_for_number(&item_value, SENTINEL_Z, "") {
        mapping.insert("z".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = find_path_for_number(&item_value, SENTINEL_YAW, "") {
        mapping.insert("yaw".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = find_path_for_number(&item_value, SENTINEL_QX, "") {
        mapping.insert("qx".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = find_path_for_number(&item_value, SENTINEL_QY, "") {
        mapping.insert("qy".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = find_path_for_number(&item_value, SENTINEL_QZ, "") {
        mapping.insert("qz".to_string(), serde_json::Value::String(p));
    }
    if let Some(p) = find_path_for_number(&item_value, SENTINEL_QW, "") {
        mapping.insert("qw".to_string(), serde_json::Value::String(p));
    }

    if !(x_path.is_some() && y_path.is_some()) {
        return Err("テンプレートからx/y座標のパスを自動検出できませんでした。Field Mappingを手動で設定してください。".to_string());
    }

    Ok(serde_json::Value::Object(mapping))
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
    fn test_import_waypoints_json() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("in.json");
        let path_str = file_path.to_str().unwrap();

        fs::write(path_str, r#"[{"id":"wp1","x":10.0,"y":20.0}]"#).unwrap();

        let res = import_waypoints(path_str);
        assert!(res.is_ok(), "Import failed: {:?}", res.err());
        let value = res.unwrap();
        assert_eq!(value[0]["id"], "wp1");
        assert_eq!(value[0]["x"], 10.0);
    }

    #[test]
    fn test_import_waypoints_yaml() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("in.yaml");
        let path_str = file_path.to_str().unwrap();

        fs::write(path_str, "- id: wp1\n  x: 10.0\n  y: 20.0\n").unwrap();

        let res = import_waypoints(path_str);
        assert!(res.is_ok(), "Import failed: {:?}", res.err());
        let value = res.unwrap();
        assert_eq!(value[0]["id"], "wp1");
        assert_eq!(value[0]["y"], 20.0);
    }

    #[test]
    fn test_import_waypoints_invalid() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("in.json");
        let path_str = file_path.to_str().unwrap();

        fs::write(path_str, "not valid json {").unwrap();

        let res = import_waypoints(path_str);
        assert!(res.is_err());
    }

    #[test]
    fn test_infer_import_mapping_nested_json_template() {
        let template = r#"{
  "keepout": { "areas": [] },
  "poses": [
{{#each waypoints}}    {
      "label": "wp_{{index}}",
      "position": { "x": {{x}}, "y": {{y}}, "z": 0 },
      "orientation": { "scalar": {{qw}}, "x": {{qx}}, "y": {{qy}}, "z": {{qz}} }
    }{{#unless @last}},{{/unless}}
{{/each}}  ]
}"#;

        let res = infer_import_mapping(template);
        assert!(res.is_ok(), "Inference failed: {:?}", res.err());
        let mapping = res.unwrap();

        assert_eq!(mapping["itemsPath"], "poses");
        assert_eq!(mapping["x"], "position.x");
        assert_eq!(mapping["y"], "position.y");
        assert_eq!(mapping["qw"], "orientation.scalar");
        assert_eq!(mapping["qx"], "orientation.x");
        assert_eq!(mapping["qy"], "orientation.y");
        assert_eq!(mapping["qz"], "orientation.z");
    }

    #[test]
    fn test_infer_import_mapping_flat_template_fails_without_position() {
        // x/yがテンプレートに存在しない場合はエラーになること
        let template = "{{#each waypoints}}PATH_{{index}}: CALL {{options.action}}\n{{/each}}";
        let res = infer_import_mapping(template);
        assert!(res.is_err());
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
            edit_layers: None,
            options_schema: None,
            export_templates: None,
            export_regions: None,
            robot_footprint: None,
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
