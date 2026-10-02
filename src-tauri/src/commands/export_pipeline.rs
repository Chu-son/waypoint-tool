use crate::map::blending::{blend_layers_to_image, LayerInput, RectRegion};
use crate::map::export_maps::{ExportLayer, ExportRegion};
use crate::templating::{self, TemplateEngine};
use base64::{engine::general_purpose, Engine as _};
use image::{codecs::pnm, ExtendedColorType, ImageEncoder};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct ExportPackageOptions {
    pub root_dir: String,
    pub conflict_resolution: String, // "overwrite" | "backup_file"
    pub session_timestamp: String,
    /// プロジェクト全体の変数。テンプレートから `globals` として参照できる。
    #[serde(default)]
    pub globals: serde_json::Map<String, serde_json::Value>,
    /// 位置合わせ後のマップ原点の緯度経度・UTM・向き。テンプレートから `geo` として参照できる。
    #[serde(default)]
    pub geo: Option<serde_json::Value>,
    /// true の場合、整数値も float（`0` → `0.0`）で出力する。受け側フォーマットが float 型を要求するため既定は有効。
    #[serde(default = "default_float_numbers")]
    pub float_numbers: bool,
    /// float 化から除外するオプション名（スキーマ上 integer 型のもの）。
    #[serde(default)]
    pub integer_keys: Vec<String>,
    pub waypoint_items: Vec<PackageWaypointItem>,
    pub map_items: Vec<PackageMapItem>,
    /// 同じフォルダに出力したマップ名の一覧ファイル（map_list.txt）。
    #[serde(default)]
    pub map_lists: Vec<PackageMapListItem>,
}

#[derive(Debug, Deserialize)]
pub struct PackageMapListItem {
    pub path: String, // Absolute target path
    pub entries: Vec<String>,
    /// true の場合は既存の行を残し、未記載の名前だけを末尾に追加する。false の場合は競合設定に従って作り直す。
    pub append: bool,
}

#[derive(Debug, Deserialize)]
pub struct PackageWaypointItem {
    pub path: String, // Absolute target path
    pub waypoints: Vec<serde_json::Value>,
    pub template: Option<String>,
    /// テンプレートのレンダリングエンジン。省略時は後方互換のため Handlebars。
    #[serde(default)]
    pub engine: TemplateEngine,
    pub image_data_b64: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PackageMapItem {
    pub save_path: String, // Absolute base path without extension (e.g. /path/to/maps/warehouse)
    pub format: String,    // "ros_standard" | "png_only"
    pub region: ExportRegion,
    pub layers: Vec<ExportLayer>,
}

#[derive(Debug, Serialize)]
pub struct ExportResultSummary {
    pub exported_files_count: usize,
    pub backed_up_files: Vec<String>,
}

/// 指定されたファイルパスのうち、実際に存在するパスを返却
pub fn check_export_conflicts(files: Vec<String>) -> Vec<String> {
    files.into_iter().filter(|f| Path::new(f).exists()).collect()
}

/// `raw_options` はテンプレートから明示的に参照するためだけのフィールドであり、
/// 既定（テンプレート未指定）の YAML/JSON 出力形式には含めない
/// （globals をテンプレート出力のみの対象とするのと同じ方針）。
fn strip_raw_options(value: &serde_json::Value) -> serde_json::Value {
    let mut v = value.clone();
    if let Some(obj) = v.as_object_mut() {
        obj.remove("raw_options");
    }
    v
}

fn default_float_numbers() -> bool {
    true
}

/// f64 で正確に表せる整数の上限（2^53）。これを超える値は精度が落ちるため変換しない。
const MAX_SAFE_INTEGER: i64 = 1 << 53;

/// 値の中のすべての整数を f64 に置き換える。`integer_keys` に含まれるキーの値は配下ごと変更しない。
fn floatify(value: &mut serde_json::Value, integer_keys: &HashSet<&str>) {
    match value {
        serde_json::Value::Number(n) => {
            let convertible = if let Some(i) = n.as_i64() {
                i.abs() <= MAX_SAFE_INTEGER
            } else {
                n.as_u64().is_some_and(|u| u <= MAX_SAFE_INTEGER as u64)
            };
            if convertible {
                if let Some(f) = n.as_f64().and_then(serde_json::Number::from_f64) {
                    *n = f;
                }
            }
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(|v| floatify(v, integer_keys)),
        serde_json::Value::Object(map) => {
            for (key, v) in map.iter_mut() {
                if !integer_keys.contains(key.as_str()) {
                    floatify(v, integer_keys);
                }
            }
        }
        _ => {}
    }
}

/// ウェイポイント 1 件の数値を float 化する。`index` は整数のまま。
/// 名前の衝突で姿勢（x, y, z ...）が除外されないよう、`integer_keys` は `options` / `raw_options` 配下にだけ適用する。
fn floatify_waypoint(waypoint: &mut serde_json::Value, integer_keys: &HashSet<&str>) {
    let Some(obj) = waypoint.as_object_mut() else {
        return;
    };
    let no_exclusions = HashSet::new();
    for (key, v) in obj.iter_mut() {
        match key.as_str() {
            "index" => {}
            "options" | "raw_options" => floatify(v, integer_keys),
            _ => floatify(v, &no_exclusions),
        }
    }
}

/// 既存のリストの行（空行は除く）を残し、まだ載っていない名前だけを末尾に足した内容を返す。
fn merge_map_list(existing: &str, entries: &[String]) -> String {
    let mut lines: Vec<String> = existing
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    for entry in entries {
        if !lines.contains(entry) {
            lines.push(entry.clone());
        }
    }
    lines.join("\n") + "\n"
}

fn backup_file_if_exists(path_str: &str, timestamp: &str, backed_up: &mut Vec<String>) -> Result<(), String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Ok(());
    }

    let mut bak_path_str = format!("{}.{}.bak", path_str, timestamp);
    let mut counter = 1;
    while Path::new(&bak_path_str).exists() {
        bak_path_str = format!("{}.{}_{}.bak", path_str, timestamp, counter);
        counter += 1;
    }

    fs::rename(path, &bak_path_str)
        .map_err(|e| format!("Failed to backup file {} to {}: {}", path_str, bak_path_str, e))?;
    backed_up.push(bak_path_str);
    Ok(())
}

pub fn execute_export_package(options: ExportPackageOptions) -> Result<ExportResultSummary, String> {
    let mut backed_up_files = Vec::new();
    let mut exported_count = 0;
    let is_backup = options.conflict_resolution == "backup_file";

    let integer_keys: HashSet<&str> = options.integer_keys.iter().map(String::as_str).collect();
    let mut globals = serde_json::Value::Object(options.globals.clone());
    if options.float_numbers {
        floatify(&mut globals, &integer_keys);
    }
    // geo は UTM ゾーン番号だけを整数のまま残し、それ以外の数値は float にそろえる。
    let mut geo = options.geo.clone().unwrap_or(serde_json::Value::Null);
    if options.float_numbers {
        floatify(&mut geo, &HashSet::from(["zone"]));
    }

    // 1. Waypoint アイテムのエクスポート処理
    for mut wp_item in options.waypoint_items {
        if options.float_numbers {
            wp_item
                .waypoints
                .iter_mut()
                .for_each(|wp| floatify_waypoint(wp, &integer_keys));
        }
        let target_path = Path::new(&wp_item.path);
        if let Some(parent) = target_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
            }
        }

        if is_backup {
            backup_file_if_exists(&wp_item.path, &options.session_timestamp, &mut backed_up_files)?;
        }

        // Handlebars/Jinja テンプレート、またはテンプレート未指定時は YAML/JSON への素の直列化。
        let content = if let Some(tmpl) = wp_item.template {
            templating::render(
                wp_item.engine,
                &tmpl,
                &serde_json::json!({ "waypoints": wp_item.waypoints, "globals": globals, "geo": geo }),
            )
            .map_err(|e| format!("Template render error for {}: {}", wp_item.path, e))?
        } else if wp_item.path.to_lowercase().ends_with(".yaml") || wp_item.path.to_lowercase().ends_with(".yml") {
            let plain_waypoints: Vec<serde_json::Value> = wp_item.waypoints.iter().map(strip_raw_options).collect();
            serde_yaml::to_string(&plain_waypoints)
                .map_err(|e| format!("YAML serialization error for {}: {}", wp_item.path, e))?
        } else {
            let plain_waypoints: Vec<serde_json::Value> = wp_item.waypoints.iter().map(strip_raw_options).collect();
            serde_json::to_string_pretty(&plain_waypoints)
                .map_err(|e| format!("JSON serialization error for {}: {}", wp_item.path, e))?
        };

        fs::write(target_path, content).map_err(|e| format!("File write error for {}: {}", wp_item.path, e))?;
        exported_count += 1;

        // Image attachment
        if let Some(b64) = wp_item.image_data_b64 {
            let png_path = target_path.with_extension("png");
            let png_path_str = png_path.to_string_lossy().to_string();

            if is_backup {
                backup_file_if_exists(&png_path_str, &options.session_timestamp, &mut backed_up_files)?;
            }

            let decoded = general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Base64 decode error for {}: {}", png_path_str, e))?;
            fs::write(&png_path, decoded).map_err(|e| format!("Image write error for {}: {}", png_path_str, e))?;
            exported_count += 1;
        }
    }

    // 2. Map アイテムのエクスポート処理
    for map_item in options.map_items {
        let base_path = Path::new(&map_item.save_path);
        if let Some(parent) = base_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
            }
        }

        // Layer decoding and blending
        let mut layers = map_item.layers;
        layers.sort_by_key(|l| l.z_index);

        let mut decoded_layers = Vec::new();
        for layer in &layers {
            if let Some(b64) = layer.image_base64.as_ref() {
                let b64_data = if b64.starts_with("data:image") {
                    b64.split(',').nth(1).unwrap_or(b64)
                } else {
                    b64
                };
                if let Ok(bytes) = general_purpose::STANDARD.decode(b64_data) {
                    if let Ok(img) = image::load_from_memory(&bytes) {
                        decoded_layers.push((layer, img));
                    }
                }
            }
        }

        let resolution = 0.05;
        let mut active_layer_inputs = Vec::new();
        for (layer, img) in &decoded_layers {
            if let Some(visible) = map_item.region.layer_visibility.get(&layer.id) {
                if !visible {
                    continue;
                }
            }

            let info = match &layer.info {
                Some(i) => i,
                None => continue,
            };

            active_layer_inputs.push(LayerInput {
                id: &layer.id,
                image: img,
                resolution: info.resolution,
                origin: info.origin,
                blend_mode: &layer.blend_mode,
                z_index: layer.z_index,
                clip: layer.clip.as_ref(),
            });
        }

        let region_rect = RectRegion {
            x: map_item.region.rect.x,
            y: map_item.region.rect.y,
            width: map_item.region.rect.width,
            height: map_item.region.rect.height,
        };

        let out_img = blend_layers_to_image(&active_layer_inputs, &region_rect, resolution);

        if map_item.format == "ros_standard" {
            let pgm_path_str = format!("{}.pgm", map_item.save_path);
            let yaml_path_str = format!("{}.yaml", map_item.save_path);

            if is_backup {
                backup_file_if_exists(&pgm_path_str, &options.session_timestamp, &mut backed_up_files)?;
                backup_file_if_exists(&yaml_path_str, &options.session_timestamp, &mut backed_up_files)?;
            }

            // Save PGM
            let luma_img = image::DynamicImage::ImageRgba8(out_img).into_luma8();
            let mut pgm_file = fs::File::create(Path::new(&pgm_path_str))
                .map_err(|e| format!("Failed to create pgm file {}: {}", pgm_path_str, e))?;
            let encoder =
                pnm::PnmEncoder::new(&mut pgm_file).with_subtype(pnm::PnmSubtype::Graymap(pnm::SampleEncoding::Binary));
            encoder
                .write_image(
                    luma_img.as_raw(),
                    luma_img.width(),
                    luma_img.height(),
                    ExtendedColorType::L8,
                )
                .map_err(|e| format!("Failed to save pgm {}: {}", pgm_path_str, e))?;
            exported_count += 1;

            // Save YAML with image path pointing to the generated PGM filename
            let pgm_filename = Path::new(&pgm_path_str)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("map.pgm");

            let yaml_content = format!(
                "image: {}\nresolution: {}\norigin: [{:.6}, {:.6}, 0.0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196\n",
                pgm_filename, resolution, map_item.region.rect.x, map_item.region.rect.y
            );
            fs::write(Path::new(&yaml_path_str), yaml_content)
                .map_err(|e| format!("Failed to write yaml {}: {}", yaml_path_str, e))?;
            exported_count += 1;
        } else {
            // PNG Only
            let png_path_str = format!("{}.png", map_item.save_path);
            if is_backup {
                backup_file_if_exists(&png_path_str, &options.session_timestamp, &mut backed_up_files)?;
            }

            out_img
                .save(Path::new(&png_path_str))
                .map_err(|e| format!("Failed to save png {}: {}", png_path_str, e))?;
            exported_count += 1;
        }
    }

    // 3. マップ一覧ファイルの出力処理
    for list in options.map_lists {
        let list_path = Path::new(&list.path);
        if let Some(parent) = list_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
            }
        }

        let content = if list.append && list_path.exists() {
            let existing =
                fs::read_to_string(list_path).map_err(|e| format!("Failed to read map list {}: {}", list.path, e))?;
            merge_map_list(&existing, &list.entries)
        } else {
            if is_backup {
                backup_file_if_exists(&list.path, &options.session_timestamp, &mut backed_up_files)?;
            }
            list.entries.join("\n") + "\n"
        };

        fs::write(list_path, content).map_err(|e| format!("Failed to write map list {}: {}", list.path, e))?;
        exported_count += 1;
    }

    Ok(ExportResultSummary {
        exported_files_count: exported_count,
        backed_up_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_check_export_conflicts() {
        let tmp = TempDir::new().unwrap();
        let file1 = tmp.path().join("file1.txt");
        let file2 = tmp.path().join("file2.txt");
        fs::write(&file1, "hello").unwrap();

        let list = vec![file1.to_string_lossy().to_string(), file2.to_string_lossy().to_string()];
        let existing = check_export_conflicts(list);
        assert_eq!(existing.len(), 1);
        assert_eq!(existing[0], file1.to_string_lossy().to_string());
    }

    #[test]
    fn test_execute_export_package_backup_file() {
        let tmp = TempDir::new().unwrap();
        let wp_path = tmp.path().join("waypoints").join("wp.yaml");
        fs::create_dir_all(wp_path.parent().unwrap()).unwrap();
        fs::write(&wp_path, "old content").unwrap();

        let options = ExportPackageOptions {
            root_dir: tmp.path().to_string_lossy().to_string(),
            conflict_resolution: "backup_file".to_string(),
            session_timestamp: "20260912_110000".to_string(),
            globals: serde_json::Map::new(),
            geo: None,
            float_numbers: false,
            integer_keys: vec![],
            waypoint_items: vec![PackageWaypointItem {
                path: wp_path.to_string_lossy().to_string(),
                waypoints: vec![serde_json::json!({ "id": "wp1", "x": 1.0, "y": 2.0 })],
                template: None,
                engine: TemplateEngine::Handlebars,
                image_data_b64: None,
            }],
            map_items: vec![],
            map_lists: vec![],
        };

        let result = execute_export_package(options).unwrap();
        assert_eq!(result.exported_files_count, 1);
        assert_eq!(result.backed_up_files.len(), 1);

        let bak_path = tmp.path().join("waypoints").join("wp.yaml.20260912_110000.bak");
        assert!(bak_path.exists());
        assert_eq!(fs::read_to_string(&bak_path).unwrap(), "old content");

        let new_content = fs::read_to_string(&wp_path).unwrap();
        assert!(new_content.contains("wp1"));
    }

    #[test]
    fn test_execute_export_package_template_can_reference_globals() {
        let tmp = TempDir::new().unwrap();
        let wp_path = tmp.path().join("wp.txt");

        let mut globals = serde_json::Map::new();
        globals.insert("default_speed".to_string(), serde_json::json!(0.5));

        let options = ExportPackageOptions {
            root_dir: tmp.path().to_string_lossy().to_string(),
            conflict_resolution: "overwrite".to_string(),
            session_timestamp: "20260912_110000".to_string(),
            globals,
            geo: None,
            float_numbers: false,
            integer_keys: vec![],
            waypoint_items: vec![PackageWaypointItem {
                path: wp_path.to_string_lossy().to_string(),
                waypoints: vec![serde_json::json!({ "id": "wp1" }), serde_json::json!({ "id": "wp2" })],
                template: Some(
                    "speed={{globals.default_speed}}\n{{#each waypoints}}{{id}}:{{@root.globals.default_speed}}\n{{/each}}"
                        .to_string(),
                ),
                engine: TemplateEngine::Handlebars,
                image_data_b64: None,
            }],
            map_items: vec![],
            map_lists: vec![],
        };

        execute_export_package(options).unwrap();

        assert_eq!(fs::read_to_string(&wp_path).unwrap(), "speed=0.5\nwp1:0.5\nwp2:0.5\n");
    }

    #[test]
    fn test_execute_export_package_default_format_omits_raw_options() {
        // raw_options はテンプレートから明示的に参照するためのフィールドであり、
        // テンプレート未指定の既定出力（YAML/JSON そのままの直列化）には含めない。
        let tmp = TempDir::new().unwrap();
        let wp_path = tmp.path().join("wp.json");

        let options = ExportPackageOptions {
            root_dir: tmp.path().to_string_lossy().to_string(),
            conflict_resolution: "overwrite".to_string(),
            session_timestamp: "20260912_110000".to_string(),
            globals: serde_json::Map::new(),
            geo: None,
            float_numbers: false,
            integer_keys: vec![],
            waypoint_items: vec![PackageWaypointItem {
                path: wp_path.to_string_lossy().to_string(),
                waypoints: vec![serde_json::json!({ "id": "wp1", "options": {"speed": 1.5}, "raw_options": {} })],
                template: None,
                engine: TemplateEngine::Handlebars,
                image_data_b64: None,
            }],
            map_items: vec![],
            map_lists: vec![],
        };

        execute_export_package(options).unwrap();

        let content = fs::read_to_string(&wp_path).unwrap();
        assert!(content.contains("\"options\""));
        assert!(!content.contains("raw_options"));
    }

    #[test]
    fn test_execute_export_package_template_can_reference_raw_options() {
        let tmp = TempDir::new().unwrap();
        let wp_path = tmp.path().join("wp.txt");

        let options = ExportPackageOptions {
            root_dir: tmp.path().to_string_lossy().to_string(),
            conflict_resolution: "overwrite".to_string(),
            session_timestamp: "20260912_110000".to_string(),
            globals: serde_json::Map::new(),
            geo: None,
            float_numbers: false,
            integer_keys: vec![],
            waypoint_items: vec![PackageWaypointItem {
                path: wp_path.to_string_lossy().to_string(),
                // options は既定値が補完された実効値、raw_options は明示的に入力された値だけを持つ、
                // という2つの見え方の違いをテンプレートから確認する。
                waypoints: vec![serde_json::json!({
                    "id": "wp1",
                    "options": {"through_tolerance": 3.0},
                    "raw_options": {}
                })],
                template: Some(
                    "{{#each waypoints}}{{id}}: options={{options.through_tolerance}} raw={{raw_options.through_tolerance}}\n{{/each}}"
                        .to_string(),
                ),
                engine: TemplateEngine::Handlebars,
                image_data_b64: None,
            }],
            map_items: vec![],
            map_lists: vec![],
        };

        execute_export_package(options).unwrap();
        let content = fs::read_to_string(&wp_path).unwrap();
        // raw_options 側は未入力のため空欄になり、options 側は補完済みの値がそのまま出力される。
        assert_eq!(content, "wp1: options=3.0 raw=\n");
    }

    #[test]
    fn test_execute_export_package_jinja_template_mg_robot_style_yaml() {
        // mg_robot の on_reached_actions（type によってフィールドが変わるタグ付きユニオンのリスト）
        // を、Jinja エンジン + toyaml フィルタで意図した YAML に書き出せることを確認する。
        let tmp = TempDir::new().unwrap();
        let wp_path = tmp.path().join("wp.yaml");

        let options = ExportPackageOptions {
            root_dir: tmp.path().to_string_lossy().to_string(),
            conflict_resolution: "overwrite".to_string(),
            session_timestamp: "20260912_110000".to_string(),
            globals: serde_json::Map::new(),
            geo: None,
            float_numbers: false,
            integer_keys: vec![],
            waypoint_items: vec![PackageWaypointItem {
                path: wp_path.to_string_lossy().to_string(),
                waypoints: vec![serde_json::json!({
                    "index": 0,
                    "x": 1.0, "y": 2.0, "z": 0.0,
                    "qx": 0.0, "qy": 0.0, "qz": 0.0, "qw": 1.0,
                    "options": {"is_through_point": false},
                    "raw_options": {
                        "on_reached_actions": [
                            {"type": "wait", "countdown_ms": 3000},
                            {"type": "amcl_reset"}
                        ]
                    }
                })],
                template: Some(
                    concat!(
                        "waypoints:\n",
                        "{% for wp in waypoints %}",
                        "  - index: {{ wp.index }}\n",
                        "    pose:\n",
                        "      position: {x: {{ wp.x }}, y: {{ wp.y }}, z: {{ wp.z }}}\n",
                        "      orientation: {x: {{ wp.qx }}, y: {{ wp.qy }}, z: {{ wp.qz }}, w: {{ wp.qw }}}\n",
                        "    navigation:\n",
                        "      is_through_point: {{ wp.options.is_through_point | tojson }}\n",
                        "{% if wp.raw_options.on_reached_actions is defined %}",
                        "    on_reached_actions:\n{{ wp.raw_options.on_reached_actions | toyaml(6) }}\n",
                        "{% endif %}",
                        "{% endfor %}"
                    )
                    .to_string(),
                ),
                engine: TemplateEngine::Jinja,
                image_data_b64: None,
            }],
            map_items: vec![],
            map_lists: vec![],
        };

        execute_export_package(options).unwrap();
        let content = fs::read_to_string(&wp_path).unwrap();

        let parsed: serde_json::Value = serde_yaml::from_str(&content).expect("rendered output must be valid YAML");
        assert_eq!(parsed["waypoints"][0]["navigation"]["is_through_point"], false);
        assert_eq!(parsed["waypoints"][0]["on_reached_actions"][0]["type"], "wait");
        assert_eq!(parsed["waypoints"][0]["on_reached_actions"][0]["countdown_ms"], 3000);
        assert_eq!(parsed["waypoints"][0]["on_reached_actions"][1]["type"], "amcl_reset");
    }

    /// フロントエンドから届く JSON と同じ形でエクスポートを実行し、出力ファイルの内容を返す。
    /// `extra` は `float_numbers` / `integer_keys` などオプションの追加フィールド。
    fn export_one(file_name: &str, template: Option<(&str, &str)>, extra: serde_json::Value) -> String {
        let tmp = TempDir::new().unwrap();
        let wp_path = tmp.path().join(file_name);
        let mut item = serde_json::json!({
            "path": wp_path.to_string_lossy(),
            "waypoints": [{
                "index": 0,
                "x": 0, "y": 2, "z": 0, "yaw": 0,
                "qx": 0, "qy": 0, "qz": 0, "qw": 1,
                "options": {"countdown_ms": 3000, "speed": 1, "nested": {"countdown_ms": 10, "z": 5}},
                "raw_options": {"speed": 1}
            }],
        });
        if let Some((engine, tmpl)) = template {
            item["engine"] = engine.into();
            item["template"] = tmpl.into();
        }
        let mut options = serde_json::json!({
            "root_dir": tmp.path().to_string_lossy(),
            "conflict_resolution": "overwrite",
            "session_timestamp": "20260912_110000",
            "globals": {"tolerance": 1},
            "waypoint_items": [item],
            "map_items": [],
        });
        options
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        let options: ExportPackageOptions = serde_json::from_value(options).unwrap();
        execute_export_package(options).unwrap();
        fs::read_to_string(&wp_path).unwrap()
    }

    #[test]
    fn test_export_writes_integers_as_float_by_default() {
        // float_numbers を省略した場合（既定）は、0 のような整数も 0.0 として出力する（index は整数のまま）。
        let yaml = export_one("wp.yaml", None, serde_json::json!({}));
        let parsed: serde_yaml::Value = serde_yaml::from_str(&yaml).unwrap();
        assert!(yaml.contains("z: 0.0"), "z must be a float: {yaml}");
        assert!(yaml.contains("qw: 1.0"), "qw must be a float: {yaml}");
        assert!(yaml.contains("index: 0\n"), "index must stay an integer: {yaml}");
        assert!(parsed[0]["x"].is_f64() && parsed[0]["index"].is_i64());

        let json = export_one("wp.json", None, serde_json::json!({}));
        assert!(json.contains("\"z\": 0.0"), "z must be a float: {json}");
        assert!(json.contains("\"index\": 0,"), "index must stay an integer: {json}");
    }

    #[test]
    fn test_export_keeps_integers_when_float_numbers_is_off() {
        let yaml = export_one("wp.yaml", None, serde_json::json!({ "float_numbers": false }));
        assert!(yaml.contains("z: 0\n"), "z must stay an integer: {yaml}");
        assert!(!yaml.contains("0.0"), "no float expected: {yaml}");
    }

    #[test]
    fn test_export_integer_keys_are_excluded_only_within_options() {
        // integer_keys は options 配下だけに効く。姿勢の z は、同名のキーが指定されていても float のまま。
        let json = export_one(
            "wp.json",
            None,
            serde_json::json!({ "integer_keys": ["countdown_ms", "z"] }),
        );
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        let wp = &parsed[0];
        assert!(wp["z"].is_f64());
        assert!(wp["options"]["countdown_ms"].is_i64(), "{json}");
        assert!(wp["options"]["nested"]["countdown_ms"].is_i64(), "{json}");
        assert!(wp["options"]["nested"]["z"].is_i64(), "{json}");
        assert!(wp["options"]["speed"].is_f64(), "{json}");
    }

    #[test]
    fn test_export_templates_receive_floats() {
        let jinja = export_one(
            "wp.txt",
            Some(("jinja", "{% for wp in waypoints %}{{ wp.index }} {{ wp.z }} {{ wp.raw_options.speed }} {{ globals.tolerance }}{% endfor %}")),
            serde_json::json!({}),
        );
        assert_eq!(jinja, "0 0.0 1.0 1.0");

        let handlebars = export_one(
            "wp.txt",
            Some((
                "handlebars",
                "{{#each waypoints}}{{index}} {{z}} {{raw_options.speed}} {{@root.globals.tolerance}}{{/each}}",
            )),
            serde_json::json!({}),
        );
        assert_eq!(handlebars, "0 0.0 1.0 1.0");
    }

    fn sample_geo() -> serde_json::Value {
        serde_json::json!({
            "lat": 35.5,
            "lon": 141,
            "utm": { "zone": 54, "hemisphere": "N", "easting": 500000, "northing": 3930000 },
            "heading_deg": -90,
            "heading": -1.25
        })
    }

    #[test]
    fn test_export_templates_can_reference_geo() {
        let jinja = export_one(
            "wp.txt",
            Some((
                "jinja",
                "{{ geo.lat }} {{ geo.utm.zone }}{{ geo.utm.hemisphere }} {{ geo.utm.easting }} {{ geo.heading_deg }}",
            )),
            serde_json::json!({ "geo": sample_geo() }),
        );
        assert_eq!(jinja, "35.5 54N 500000.0 -90.0");

        let handlebars = export_one(
            "wp.txt",
            Some((
                "handlebars",
                "{{@root.geo.lon}} {{#each waypoints}}{{@root.geo.utm.zone}} {{@root.geo.utm.northing}}{{/each}}",
            )),
            serde_json::json!({ "geo": sample_geo() }),
        );
        assert_eq!(handlebars, "141.0 54 3930000.0");
    }

    #[test]
    fn test_export_keeps_geo_values_as_given_when_float_numbers_is_off() {
        let out = export_one(
            "wp.txt",
            Some(("jinja", "{{ geo.utm.easting }} {{ geo.utm.zone }}")),
            serde_json::json!({ "geo": sample_geo(), "float_numbers": false }),
        );
        assert_eq!(out, "500000 54");
    }

    /// map_lists だけを持つ最小のリクエストを実行する。
    fn export_map_list(dir: &Path, conflict_resolution: &str, append: bool, entries: &[&str]) -> ExportResultSummary {
        let options: ExportPackageOptions = serde_json::from_value(serde_json::json!({
            "root_dir": dir.to_string_lossy(),
            "conflict_resolution": conflict_resolution,
            "session_timestamp": "20260912_110000",
            "waypoint_items": [],
            "map_items": [],
            "map_lists": [{
                "path": dir.join("Map").join("map_list.txt").to_string_lossy(),
                "entries": entries,
                "append": append,
            }],
        }))
        .unwrap();
        execute_export_package(options).unwrap()
    }

    #[test]
    fn test_map_list_is_created_with_one_name_per_line() {
        let tmp = TempDir::new().unwrap();
        let result = export_map_list(tmp.path(), "overwrite", true, &["a", "b"]);

        assert_eq!(result.exported_files_count, 1);
        assert_eq!(
            fs::read_to_string(tmp.path().join("Map").join("map_list.txt")).unwrap(),
            "a\nb\n"
        );
    }

    #[test]
    fn test_map_list_append_keeps_existing_lines_and_skips_duplicates() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Map")).unwrap();
        fs::write(tmp.path().join("Map").join("map_list.txt"), "old\na\n\n").unwrap();

        let result = export_map_list(tmp.path(), "backup_file", true, &["a", "b"]);

        assert_eq!(
            fs::read_to_string(tmp.path().join("Map").join("map_list.txt")).unwrap(),
            "old\na\nb\n"
        );
        assert!(result.backed_up_files.is_empty(), "appending does not back up the list");
    }

    #[test]
    fn test_map_list_follows_conflict_resolution_when_not_appending() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path().join("Map")).unwrap();
        fs::write(tmp.path().join("Map").join("map_list.txt"), "old\n").unwrap();

        let result = export_map_list(tmp.path(), "backup_file", false, &["a"]);

        assert_eq!(
            fs::read_to_string(tmp.path().join("Map").join("map_list.txt")).unwrap(),
            "a\n"
        );
        assert_eq!(result.backed_up_files.len(), 1);
        assert_eq!(fs::read_to_string(&result.backed_up_files[0]).unwrap(), "old\n");
    }

    #[test]
    fn test_floatify_leaves_integers_beyond_f64_precision_untouched() {
        let mut value = serde_json::json!({ "small": 3, "big": 9_007_199_254_740_993_i64, "neg": -2 });
        floatify(&mut value, &HashSet::new());
        assert!(value["small"].is_f64() && value["neg"].is_f64());
        assert!(value["big"].is_i64());
    }
}
