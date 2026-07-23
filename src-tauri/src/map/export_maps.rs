use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use image::{codecs::pnm, ImageEncoder, ExtendedColorType};
use base64::{engine::general_purpose, Engine as _};
use crate::models::MapInfo;
use super::blending::{blend_layers_to_image, LayerInput, RectRegion};

#[derive(Debug, Deserialize)]
pub struct ExportMapsOptions {
    #[serde(rename = "saveDir")]
    pub save_dir: String,
    pub format: String, // "ros_standard" | "png_only"
    #[serde(rename = "mapListFilename")]
    pub map_list_filename: Option<String>,
    pub regions: Vec<ExportRegion>,
    pub layers: Vec<ExportLayer>,
}

#[derive(Debug, Deserialize)]
pub struct ExportRegion {
    pub name: String,
    pub rect: Rect,
    #[serde(rename = "layerVisibility")]
    pub layer_visibility: HashMap<String, bool>,
}

#[derive(Debug, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
pub struct ExportLayer {
    pub id: String,
    pub name: String,
    pub image_base64: Option<String>,
    pub info: Option<MapInfo>,
    pub opacity: f64,
    pub blend_mode: String,
    pub z_index: i32,
}

pub fn export_maps(options: ExportMapsOptions) -> Result<(), String> {
    let save_dir = Path::new(&options.save_dir);
    if !save_dir.exists() {
        fs::create_dir_all(save_dir).map_err(|e| format!("Failed to create save directory: {}", e))?;
    }

    let mut map_names = Vec::new();

    // Decode all layer images first to avoid redundant decoding
    let mut decoded_layers = Vec::new();
    let mut layers = options.layers;
    layers.sort_by_key(|l| l.z_index);

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
                } else {
                    println!("Warning: Failed to load image from decoded bytes for layer {}", layer.id);
                }
            } else {
                println!("Warning: Failed to decode base64 for layer {}", layer.id);
            }
        }
    }

    for region in options.regions {
        // Base resolution
        let resolution = 0.05; // Default standard ROS resolution
        
        let width_px = (region.rect.width / resolution).round() as u32;
        let height_px = (region.rect.height / resolution).round() as u32;

        if width_px == 0 || height_px == 0 {
            continue; // Skip invalid regions
        }

        // Build active layers for this region
        let mut active_layer_inputs = Vec::new();
        for (layer, img) in &decoded_layers {
            if let Some(visible) = region.layer_visibility.get(&layer.id) {
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
            x: region.rect.x,
            y: region.rect.y,
            width: region.rect.width,
            height: region.rect.height,
        };

        let out_img = blend_layers_to_image(&active_layer_inputs, &region_rect, resolution);

        // Save image
        if options.format == "ros_standard" {
            let img_filename = format!("{}.pgm", region.name);
            let img_path = save_dir.join(&img_filename);
            
            // convert to luma8
            let luma_img = image::DynamicImage::ImageRgba8(out_img).into_luma8();
            
            let mut pgm_file = fs::File::create(&img_path)
                .map_err(|e| format!("Failed to create image file {}: {}", img_filename, e))?;
            
            let encoder = pnm::PnmEncoder::new(&mut pgm_file)
                .with_subtype(pnm::PnmSubtype::Graymap(pnm::SampleEncoding::Binary));
                
            encoder.write_image(
                luma_img.as_raw(),
                luma_img.width(),
                luma_img.height(),
                ExtendedColorType::L8
            ).map_err(|e| format!("Failed to save image {}: {}", img_filename, e))?;

            let yaml_filename = format!("{}.yaml", region.name);
            let yaml_path = save_dir.join(&yaml_filename);
            let yaml_content = format!(
                "image: {}\nresolution: {}\norigin: [{:.6}, {:.6}, 0.0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196\n",
                img_filename, resolution, region.rect.x, region.rect.y
            );
            fs::write(yaml_path, yaml_content).map_err(|e| format!("Failed to write yaml for {}: {}", region.name, e))?;
        } else {
            let img_filename = format!("{}.png", region.name);
            let img_path = save_dir.join(&img_filename);
            out_img.save(&img_path).map_err(|e| format!("Failed to save image {}: {}", img_filename, e))?;
        }

        map_names.push(region.name);
    }

    if let Some(list_filename) = options.map_list_filename {
        let list_path = save_dir.join(list_filename);
        let content = map_names.join("\n") + "\n";
        fs::write(list_path, content).map_err(|e| format!("Failed to write map list: {}", e))?;
    }

    Ok(())
}
