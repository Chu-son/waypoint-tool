use serde::Deserialize;
use base64::{engine::general_purpose, Engine as _};
use super::blending::{blend_layers_to_image, LayerInput, RectRegion};

#[derive(Debug, Deserialize)]
pub struct BlendPreviewLayer {
    pub id: String,
    pub image_base64: Option<String>,
    pub info: Option<serde_json::Value>,
    pub blend_mode: String,
    pub z_index: i32,
    pub visible: bool,
}

#[derive(serde::Serialize)]
pub struct BlendPreviewResult {
    pub image_data_b64: String,
    pub width: u32,
    pub height: u32,
    pub origin: [f64; 3],
    pub resolution: f64,
}

pub fn blend_map_preview(layers: Vec<BlendPreviewLayer>) -> Result<BlendPreviewResult, String> {
    let mut visible: Vec<_> = layers.into_iter()
        .filter(|l| l.visible && l.image_base64.is_some())
        .collect();
    visible.sort_by_key(|l| l.z_index);

    if visible.is_empty() {
        return Err("No visible layers".to_string());
    }

    let mut decoded = Vec::new();
    for layer in &visible {
        let b64 = layer.image_base64.as_ref().unwrap();
        let b64_data = if b64.starts_with("data:image") {
            b64.split(',').nth(1).unwrap_or(b64)
        } else { b64 };
        let bytes = general_purpose::STANDARD.decode(b64_data)
            .map_err(|e| format!("Base64 decode error: {}", e))?;
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Image load error: {}", e))?;
        decoded.push((layer, img));
    }

    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    let mut min_resolution = f64::MAX;

    for (layer, img) in &decoded {
        let info = layer.info.as_ref();
        let l_res = info.and_then(|i| i.get("resolution")).and_then(|v| v.as_f64()).unwrap_or(0.05);
        let l_orig = info.and_then(|i| i.get("origin")).and_then(|v| v.as_array());
        let l_ox = l_orig.as_ref().and_then(|a| a.get(0)).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let l_oy = l_orig.as_ref().and_then(|a| a.get(1)).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let l_oyaw = l_orig.as_ref().and_then(|a| a.get(2)).and_then(|v| v.as_f64()).unwrap_or(0.0);

        let w_meters = img.width() as f64 * l_res;
        let h_meters = img.height() as f64 * l_res;

        if l_res < min_resolution {
            min_resolution = l_res;
        }

        if l_oyaw.abs() < 1e-9 {
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
        } else {
            let cos_yaw = l_oyaw.cos();
            let sin_yaw = l_oyaw.sin();
            let corners = [
                (0.0, 0.0),
                (w_meters, 0.0),
                (w_meters, h_meters),
                (0.0, h_meters),
            ];
            for (cx, cy) in corners {
                let wx = l_ox + cx * cos_yaw - cy * sin_yaw;
                let wy = l_oy + cx * sin_yaw + cy * cos_yaw;
                if wx < min_x { min_x = wx; }
                if wy < min_y { min_y = wy; }
                if wx > max_x { max_x = wx; }
                if wy > max_y { max_y = wy; }
            }
        }
    }

    if min_resolution == f64::MAX {
        min_resolution = 0.05;
    }
    let resolution = min_resolution;
    let out_w = (((max_x - min_x) / resolution).ceil() as u32).max(1);
    let out_h = (((max_y - min_y) / resolution).ceil() as u32).max(1);

    let mut layer_inputs = Vec::new();
    for (layer, img) in &decoded {
        let info = layer.info.as_ref();
        let l_res = info.and_then(|i| i.get("resolution")).and_then(|v| v.as_f64()).unwrap_or(0.05);
        let l_orig = info.and_then(|i| i.get("origin")).and_then(|v| v.as_array());
        let l_ox = l_orig.as_ref().and_then(|a| a.get(0)).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let l_oy = l_orig.as_ref().and_then(|a| a.get(1)).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let l_oyaw = l_orig.as_ref().and_then(|a| a.get(2)).and_then(|v| v.as_f64()).unwrap_or(0.0);

        layer_inputs.push(LayerInput {
            id: &layer.id,
            image: img,
            resolution: l_res,
            origin: [l_ox, l_oy, l_oyaw],
            blend_mode: &layer.blend_mode,
            z_index: layer.z_index,
        });
    }

    let region = RectRegion {
        x: min_x,
        y: min_y,
        width: out_w as f64 * resolution,
        height: out_h as f64 * resolution,
    };

    let out_img = blend_layers_to_image(&layer_inputs, &region, resolution);

    let mut png_data: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_data);
    image::DynamicImage::ImageRgba8(out_img)
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encode error: {}", e))?;
    let b64 = general_purpose::STANDARD.encode(&png_data);

    Ok(BlendPreviewResult {
        image_data_b64: format!("data:image/png;base64,{}", b64),
        width: out_w,
        height: out_h,
        origin: [min_x, min_y, 0.0],
        resolution,
    })
}
