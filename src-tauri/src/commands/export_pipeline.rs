use crate::map::blending::{blend_layers_to_image, LayerInput, RectRegion};
use crate::map::export_maps::{ExportLayer, ExportRegion};
use base64::{engine::general_purpose, Engine as _};
use handlebars::Handlebars;
use image::{codecs::pnm, ExtendedColorType, ImageEncoder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct ExportPackageOptions {
    pub root_dir: String,
    pub conflict_resolution: String, // "overwrite" | "backup_file"
    pub session_timestamp: String,
    pub waypoint_items: Vec<PackageWaypointItem>,
    pub map_items: Vec<PackageMapItem>,
}

#[derive(Debug, Deserialize)]
pub struct PackageWaypointItem {
    pub path: String, // Absolute target path
    pub waypoints: Vec<serde_json::Value>,
    pub template: Option<String>,
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

    // 1. Waypoint アイテムのエクスポート処理
    for wp_item in options.waypoint_items {
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

        // Handlebars or YAML/JSON serialization
        let content = if let Some(tmpl) = wp_item.template {
            let reg = Handlebars::new();
            reg.render_template(&tmpl, &serde_json::json!({ "waypoints": wp_item.waypoints }))
                .map_err(|e| format!("Template render error for {}: {}", wp_item.path, e))?
        } else if wp_item.path.to_lowercase().ends_with(".yaml") || wp_item.path.to_lowercase().ends_with(".yml") {
            serde_yaml::to_string(&wp_item.waypoints)
                .map_err(|e| format!("YAML serialization error for {}: {}", wp_item.path, e))?
        } else {
            serde_json::to_string_pretty(&wp_item.waypoints)
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
            waypoint_items: vec![PackageWaypointItem {
                path: wp_path.to_string_lossy().to_string(),
                waypoints: vec![serde_json::json!({ "id": "wp1", "x": 1.0, "y": 2.0 })],
                template: None,
                image_data_b64: None,
            }],
            map_items: vec![],
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
}
