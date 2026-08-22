use image::RgbaImage;
use base64::{engine::general_purpose, Engine as _};
use flate2::{write::ZlibEncoder, Compression};
use std::io::Write;
use crate::plugins::models::{PluginMapLayer, OccupancyGridData};
use super::blending::{apply_blend_cell, CellValue};

#[derive(Debug, Clone)]
pub struct LayerForBlend {
    pub id: String,
    pub image: RgbaImage,
    pub blend_mode: String,
    pub visible: bool,
    pub z_index: i32,
    pub resolution: f64,
    pub origin: [f64; 3],
    pub negate: bool,
    pub occ_thresh: f64,
    pub free_thresh: f64,
}

pub fn parse_layer_info(info: Option<&serde_json::Value>) -> Result<(f64, [f64; 3], bool, f64, f64), String> {
    let info = info.ok_or("Map layer has no info")?;
    let resolution = info.get("resolution").and_then(|v| v.as_f64()).unwrap_or(0.05);
    let origin_arr = info.get("origin").and_then(|v| v.as_array()).ok_or("Map info missing origin")?;
    let ox = origin_arr.get(0).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let oy = origin_arr.get(1).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let oyaw = origin_arr.get(2).and_then(|v| v.as_f64()).unwrap_or(0.0);
    let negate = info.get("negate").and_then(|v| v.as_i64()).unwrap_or(0) != 0;
    let occ_thresh = info.get("occupied_thresh").and_then(|v| v.as_f64()).unwrap_or(0.65);
    let free_thresh = info.get("free_thresh").and_then(|v| v.as_f64()).unwrap_or(0.196);

    Ok((resolution, [ox, oy, oyaw], negate, occ_thresh, free_thresh))
}

pub fn world_to_pixel(
    world_x: f64,
    world_y: f64,
    origin: [f64; 3],
    resolution: f64,
    img_height: u32,
) -> (i32, i32) {
    let col = ((world_x - origin[0]) / resolution).round() as i32;
    let row = (img_height as f64 - 1.0 - (world_y - origin[1]) / resolution).round() as i32;
    (col, row)
}

pub fn evaluate_pixel(
    pixel: [u8; 4],
    negate: bool,
    occ_thresh: f64,
    free_thresh: f64,
) -> CellValue {
    if pixel[3] < 128 {
        return CellValue::Unknown;
    }
    let gray = (pixel[0] as f32 * 0.299 + pixel[1] as f32 * 0.587 + pixel[2] as f32 * 0.114) as u8;

    // In ROS standard PGM maps, gray value 205 (0xCD) is the exact canonical value for Unknown space.
    // In trinary map representation, intermediate gray levels (128..=230) represent Unknown / Unexplored space.
    if !negate && (gray >= 128 && gray <= 230) {
        return CellValue::Unknown;
    }

    let normalized = if negate {
        gray as f64 / 255.0
    } else {
        1.0 - gray as f64 / 255.0
    };
    if normalized >= occ_thresh {
        CellValue::Obstacle
    } else if normalized <= free_thresh {
        CellValue::Free
    } else {
        CellValue::Unknown
    }
}

pub fn build_occupancy_grid_from_layers(
    layers: &[&PluginMapLayer],
) -> Result<OccupancyGridData, String> {
    if layers.is_empty() {
        return Err("No map layers provided".to_string());
    }

    let mut decoded_layers = Vec::new();
    for layer in layers {
        if !layer.visible {
            continue;
        }
        let (resolution, origin, negate, occ_thresh, free_thresh) = parse_layer_info(layer.info.as_ref())?;
        let b64 = layer.image_base64.split(',').last().unwrap_or(&layer.image_base64);
        let bytes = general_purpose::STANDARD.decode(b64).map_err(|e| format!("Base64 decode error: {}", e))?;
        let img = image::load_from_memory(&bytes).map_err(|e| format!("Image load error: {}", e))?.to_rgba8();

        decoded_layers.push(LayerForBlend {
            id: String::new(),
            image: img,
            blend_mode: layer.blend_mode.clone(),
            visible: layer.visible,
            z_index: layer.z_index,
            resolution,
            origin,
            negate,
            occ_thresh,
            free_thresh,
        });
    }

    if decoded_layers.is_empty() {
        return Err("No visible map layers provided".to_string());
    }

    // z_index でソート
    decoded_layers.sort_by_key(|l| l.z_index);

    // ベースレイヤー（最初のレイヤー）のパラメータを使用
    let base_res = decoded_layers[0].resolution;
    let base_origin = decoded_layers[0].origin;
    let width = decoded_layers[0].image.width();
    let height = decoded_layers[0].image.height();

    let mut data_raw = Vec::with_capacity((width * height) as usize);

    for r in 0..height {
        for c in 0..width {
            // ワールド座標
            let world_x = base_origin[0] + (c as f64) * base_res;
            let world_y = base_origin[1] + ((height - 1 - r) as f64) * base_res;

            let mut combined_cell = CellValue::Unknown;

            for layer in &decoded_layers {
                let (c_l, r_l) = world_to_pixel(world_x, world_y, layer.origin, layer.resolution, layer.image.height());
                if c_l >= 0 && c_l < layer.image.width() as i32 && r_l >= 0 && r_l < layer.image.height() as i32 {
                    let pixel = layer.image.get_pixel(c_l as u32, r_l as u32);
                    let cell = evaluate_pixel(pixel.0, layer.negate, layer.occ_thresh, layer.free_thresh);

                    combined_cell = apply_blend_cell(combined_cell, cell, &layer.blend_mode);
                }
            }
            data_raw.push(combined_cell.to_occupancy_grid_val() as u8);
        }
    }

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    encoder.write_all(&data_raw).map_err(|e| format!("Compression failed: {}", e))?;
    let compressed = encoder.finish().map_err(|e| format!("Compression finish failed: {}", e))?;
    let b64 = general_purpose::STANDARD.encode(&compressed);

    Ok(OccupancyGridData {
        width,
        height,
        resolution: base_res,
        origin: base_origin,
        data: b64,
        encoding: "int8_zlib_base64".to_string(),
        cell_values: crate::plugins::models::CellValueConstants::default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evaluate_pixel_with_ros_nav2_thresh() {
        // Nav2 default YAML with free_thresh: 0.25, occupied_thresh: 0.65
        let occ_thresh = 0.65;
        let free_thresh = 0.25;

        // Obstacle (black, gray=0) -> Obstacle
        assert_eq!(
            evaluate_pixel([0, 0, 0, 255], false, occ_thresh, free_thresh),
            CellValue::Obstacle
        );

        // Free space (white, gray=254 or 255) -> Free
        assert_eq!(
            evaluate_pixel([254, 254, 254, 255], false, occ_thresh, free_thresh),
            CellValue::Free
        );
        assert_eq!(
            evaluate_pixel([255, 255, 255, 255], false, occ_thresh, free_thresh),
            CellValue::Free
        );

        // Canonical ROS Unknown space (gray=205 / 0xCD) -> Unknown!
        assert_eq!(
            evaluate_pixel([205, 205, 205, 255], false, occ_thresh, free_thresh),
            CellValue::Unknown
        );

        // Alpha transparent -> Unknown
        assert_eq!(
            evaluate_pixel([255, 255, 255, 0], false, occ_thresh, free_thresh),
            CellValue::Unknown
        );
    }
}
