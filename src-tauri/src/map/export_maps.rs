use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use image::{GenericImageView, RgbaImage, Rgba, Pixel, ImageEncoder, codecs::pnm, ExtendedColorType};
use base64::{engine::general_purpose, Engine as _};
use crate::models::MapInfo;

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

    for layer in layers {
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

        let mut out_img = RgbaImage::from_pixel(width_px, height_px, Rgba([205, 205, 205, 255]));

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

            let l_res = info.resolution;
            let l_ox = info.origin[0];
            let l_oy = info.origin[1];
            let l_w = img.width() as f64;
            let l_h = img.height() as f64;

            for r in 0..height_px {
                for c in 0..width_px {
                    let world_x = region.rect.x + (c as f64) * resolution;
                    let world_y = region.rect.y + ((height_px - 1 - r) as f64) * resolution;

                    // Map to layer pixel
                    let c_l = ((world_x - l_ox) / l_res).round() as i32;
                    let r_l = (l_h - 1.0 - (world_y - l_oy) / l_res).round() as i32;

                    if c_l >= 0 && c_l < l_w as i32 && r_l >= 0 && r_l < l_h as i32 {
                        let l_pixel = img.get_pixel(c_l as u32, r_l as u32);
                        let l_rgba = l_pixel.to_rgba();
                        
                        // Ignore UI layer opacity for export blending, as ROS maps don't support partial transparency.
                        // We use the image's inherent alpha channel, thresholding at 0.5.
                        let img_alpha = l_rgba[3] as f64 / 255.0;
                        if img_alpha < 0.5 {
                            continue;
                        }
                        let alpha = 1.0;

                        let out_pixel = out_img.get_pixel_mut(c, r);
                        
                        let l_is_obstacle = l_rgba[0] < 128;
                        let l_is_free = l_rgba[0] > 230;
                        let o_is_obstacle = out_pixel[0] < 128;
                        let o_is_free = out_pixel[0] > 230;

                        match layer.blend_mode.as_str() {
                            "merge_obstacles" => {
                                // Merge Obstacles (Preserve Free)
                                // If either is obstacle, result is obstacle.
                                // Else if either is free, result is free.
                                // Else unknown.
                                if l_is_obstacle || o_is_obstacle {
                                    for i in 0..3 { out_pixel[i] = ((l_rgba[i] as f64) * alpha + 0.0 * (1.0 - alpha)) as u8; out_pixel[i] = out_pixel[i].min(0); } // Force black
                                    out_pixel[0] = 0; out_pixel[1] = 0; out_pixel[2] = 0;
                                } else if l_is_free || o_is_free {
                                    out_pixel[0] = 254; out_pixel[1] = 254; out_pixel[2] = 254;
                                } else {
                                    out_pixel[0] = 205; out_pixel[1] = 205; out_pixel[2] = 205;
                                }
                            },
                            "merge_free" => {
                                // Merge Free Space
                                // If either is free, result is free.
                                // Else if either is obstacle, result is obstacle.
                                // Else unknown.
                                if l_is_free || o_is_free {
                                    out_pixel[0] = 254; out_pixel[1] = 254; out_pixel[2] = 254;
                                } else if l_is_obstacle || o_is_obstacle {
                                    out_pixel[0] = 0; out_pixel[1] = 0; out_pixel[2] = 0;
                                } else {
                                    out_pixel[0] = 205; out_pixel[1] = 205; out_pixel[2] = 205;
                                }
                            },
                            _ => { 
                                // "overwrite" or "normal"
                                // Overwrite with top layer, unless top layer is unknown
                                if !l_is_obstacle && !l_is_free {
                                    // Top is unknown, keep bottom (do nothing)
                                } else {
                                    for i in 0..3 {
                                        out_pixel[i] = ((l_rgba[i] as f64) * alpha + (out_pixel[i] as f64) * (1.0 - alpha)) as u8;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

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
