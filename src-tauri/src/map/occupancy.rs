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
    let gray_raw = pixel[0] as f64 * 0.299 + pixel[1] as f64 * 0.587 + pixel[2] as f64 * 0.114;

    // Canonical ROS Unknown space (gray value 205 / 0xCD, typical range 198 ~ 212)
    if !negate && (gray_raw >= 198.0 && gray_raw <= 212.0) {
        return CellValue::Unknown;
    }

    let gray = gray_raw / 255.0;
    let normalized = if negate {
        gray
    } else {
        1.0 - gray
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
        if b64.trim().is_empty() {
            continue;
        }
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

    // z_index 昇順にソート (下層から上層へ)
    decoded_layers.sort_by_key(|l| l.z_index);

    // 全レイヤーを包含するバウンディングボックスと最小解像度を計算
    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    let mut min_resolution = f64::MAX;

    for layer in &decoded_layers {
        let l_res = layer.resolution;
        let l_ox = layer.origin[0];
        let l_oy = layer.origin[1];
        let w_meters = layer.image.width() as f64 * l_res;
        let h_meters = layer.image.height() as f64 * l_res;

        if l_res < min_resolution {
            min_resolution = l_res;
        }
        if l_ox < min_x {
            min_x = l_ox;
        }
        if l_oy < min_y {
            min_y = l_oy;
        }
        if l_ox + w_meters > max_x {
            max_x = l_ox + w_meters;
        }
        if l_oy + h_meters > max_y {
            max_y = l_oy + h_meters;
        }
    }

    if min_resolution == f64::MAX {
        min_resolution = 0.05;
    }
    let resolution = min_resolution;
    let out_w = (((max_x - min_x) / resolution).ceil() as u32).max(1);
    let out_h = (((max_y - min_y) / resolution).ceil() as u32).max(1);

    let oyaw = decoded_layers[0].origin[2];

    let mut data_raw = Vec::with_capacity((out_w * out_h) as usize);

    for r in 0..out_h {
        for c in 0..out_w {
            // ワールド座標
            let world_x = min_x + (c as f64) * resolution;
            let world_y = min_y + ((out_h - 1 - r) as f64) * resolution;

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
        width: out_w,
        height: out_h,
        resolution,
        origin: [min_x, min_y, oyaw],
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
        // Nav2 standard YAML with free_thresh: 0.196, occupied_thresh: 0.65
        let occ_thresh = 0.65;
        let free_thresh = 0.196;

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

    #[test]
    fn test_build_occupancy_grid_from_layers_multiple() {
        use image::{Rgba, RgbaImage};

        // Create a base map (10x10, all white/Free: [254, 254, 254, 255])
        let mut base_img = RgbaImage::new(10, 10);
        for pixel in base_img.pixels_mut() {
            *pixel = Rgba([254, 254, 254, 255]);
        }
        let mut base_png = Vec::new();
        image::DynamicImage::ImageRgba8(base_img)
            .write_to(&mut std::io::Cursor::new(&mut base_png), image::ImageFormat::Png)
            .unwrap();
        let base_b64 = general_purpose::STANDARD.encode(&base_png);

        // Create a custom layer on top (10x10, with an obstacle [0, 0, 0, 255] at 0,0)
        let mut top_img = RgbaImage::new(10, 10);
        for pixel in top_img.pixels_mut() {
            *pixel = Rgba([0, 0, 0, 0]); // transparent
        }
        top_img.put_pixel(5, 5, Rgba([0, 0, 0, 255])); // obstacle in center
        let mut top_png = Vec::new();
        image::DynamicImage::ImageRgba8(top_img)
            .write_to(&mut std::io::Cursor::new(&mut top_png), image::ImageFormat::Png)
            .unwrap();
        let top_b64 = general_purpose::STANDARD.encode(&top_png);

        let layer1 = PluginMapLayer {
            image_base64: base_b64,
            info: Some(serde_json::json!({
                "resolution": 0.1,
                "origin": [0.0, 0.0, 0.0],
                "negate": 0,
                "occupied_thresh": 0.65,
                "free_thresh": 0.196
            })),
            visible: true,
            blend_mode: "overwrite".to_string(),
            z_index: 0,
        };

        let layer2 = PluginMapLayer {
            image_base64: top_b64,
            info: Some(serde_json::json!({
                "resolution": 0.1,
                "origin": [0.0, 0.0, 0.0],
                "negate": 0,
                "occupied_thresh": 0.65,
                "free_thresh": 0.196
            })),
            visible: true,
            blend_mode: "overwrite".to_string(),
            z_index: 1000,
        };

        let grid = build_occupancy_grid_from_layers(&[&layer1, &layer2]).unwrap();
        assert_eq!(grid.width, 10);
        assert_eq!(grid.height, 10);
        assert_eq!(grid.resolution, 0.1);
    }
}
