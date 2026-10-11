use super::blending::{blend_layers_to_cells, LayerClip, LayerInput, RectRegion};
use super::layer_decode::{decode_layer, ClassifiedLayer, LayerDecodeError};
use image::{codecs::pnm, ExtendedColorType, ImageEncoder};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

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
    pub info: Option<ExportLayerInfo>,
    pub opacity: f64,
    pub blend_mode: String,
    pub z_index: i32,
    #[serde(default)]
    pub clip: Option<LayerClip>,
}

#[derive(Debug, Deserialize)]
pub struct ExportLayerInfo {
    pub resolution: f64,
    pub origin: [f64; 3],
}

/// 出力するリージョンのどれかに描かれるレイヤーだけをデコードする（位置情報が無いレイヤーと、
/// 全リージョンで非表示のレイヤーは使われないので読まない）。リージョンの `layerVisibility` にエントリが無いレイヤーは表示扱い。
/// レイヤーごとに並列にデコードし、結果は `layers` の順序を保つ。デコードできないレイヤーは `on_error` に知らせて除外する。
pub fn decode_drawn_layers<'a>(
    layers: &'a [ExportLayer],
    region_visibilities: &[&HashMap<String, bool>],
    on_error: &(dyn Fn(&ExportLayer, &LayerDecodeError) + Sync),
) -> Vec<(&'a ExportLayer, ClassifiedLayer)> {
    layers
        .par_iter()
        .filter(|layer| {
            layer.info.is_some()
                && region_visibilities
                    .iter()
                    .any(|visibility| visibility.get(&layer.id).copied().unwrap_or(true))
        })
        .filter_map(|layer| {
            let b64 = layer.image_base64.as_ref()?;
            match decode_layer(b64) {
                Ok(classified) => Some((layer, classified)),
                Err(e) => {
                    on_error(layer, &e);
                    None
                }
            }
        })
        .collect()
}

pub fn export_maps(options: ExportMapsOptions) -> Result<(), String> {
    let save_dir = Path::new(&options.save_dir);
    if !save_dir.exists() {
        fs::create_dir_all(save_dir).map_err(|e| format!("Failed to create save directory: {}", e))?;
    }

    let mut map_names = Vec::new();

    // Decode the layer images that some region draws once, up front, to avoid redundant decoding
    let mut layers = options.layers;
    layers.sort_by_key(|l| l.z_index);
    let visibilities: Vec<_> = options.regions.iter().map(|r| &r.layer_visibility).collect();
    let decoded_layers = decode_drawn_layers(&layers, &visibilities, &|layer, e| {
        println!("Warning: Failed to decode image for layer {}: {}", layer.id, e);
    });

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
                clip: layer.clip.as_ref(),
            });
        }

        let region_rect = RectRegion {
            x: region.rect.x,
            y: region.rect.y,
            width: region.rect.width,
            height: region.rect.height,
        };

        let blended = blend_layers_to_cells(&active_layer_inputs, &region_rect, resolution);

        // Save image
        if options.format == "ros_standard" {
            let img_filename = format!("{}.pgm", region.name);
            let img_path = save_dir.join(&img_filename);

            let luma = blended.to_luma8();

            let mut pgm_file = fs::File::create(&img_path)
                .map_err(|e| format!("Failed to create image file {}: {}", img_filename, e))?;

            let encoder =
                pnm::PnmEncoder::new(&mut pgm_file).with_subtype(pnm::PnmSubtype::Graymap(pnm::SampleEncoding::Binary));

            encoder
                .write_image(&luma, blended.width, blended.height, ExtendedColorType::L8)
                .map_err(|e| format!("Failed to save image {}: {}", img_filename, e))?;

            let yaml_filename = format!("{}.yaml", region.name);
            let yaml_path = save_dir.join(&yaml_filename);
            let yaml_content = format!(
                "image: {}\nresolution: {}\norigin: [{:.6}, {:.6}, 0.0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196\n",
                img_filename, resolution, region.rect.x, region.rect.y
            );
            fs::write(yaml_path, yaml_content)
                .map_err(|e| format!("Failed to write yaml for {}: {}", region.name, e))?;
        } else {
            let img_filename = format!("{}.png", region.name);
            let img_path = save_dir.join(&img_filename);
            blended
                .to_rgba_image()
                .save(&img_path)
                .map_err(|e| format!("Failed to save image {}: {}", img_filename, e))?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_options_without_unused_map_info_fields() {
        let json = r#"
        {
            "saveDir": "/tmp/export",
            "format": "png_only",
            "mapListFilename": null,
            "regions": [],
            "layers": [
                {
                    "id": "map-1",
                    "name": "Map 1",
                    "image_base64": "data:image/png;base64,AA==",
                    "info": {
                        "resolution": 0.05,
                        "origin": [1.0, 2.0, 0.0]
                    },
                    "opacity": 1.0,
                    "blend_mode": "overwrite",
                    "z_index": 0
                }
            ]
        }
        "#;

        let options: ExportMapsOptions = serde_json::from_str(json).unwrap();
        let info = options.layers[0].info.as_ref().unwrap();

        assert_eq!(info.resolution, 0.05);
        assert_eq!(info.origin, [1.0, 2.0, 0.0]);
        assert!(options.layers[0].clip.is_none());
    }

    #[test]
    fn deserialize_layer_clip_from_frontend_payload() {
        let json = r#"
        {
            "id": "map-1",
            "name": "Map 1",
            "image_base64": null,
            "info": null,
            "opacity": 1.0,
            "blend_mode": "overwrite",
            "z_index": 0,
            "clip": { "rects": [{ "x": 0.0, "y": -1.0, "width": 2.5, "height": 4.0 }] }
        }
        "#;

        let layer: ExportLayer = serde_json::from_str(json).unwrap();
        let clip = layer.clip.unwrap();

        assert!(clip.contains(1.0, 0.0));
        assert!(!clip.contains(2.5, 0.0), "right edge is exclusive");
        assert!(!clip.contains(1.0, -1.5));
    }

    fn layer_with_image(id: &str, image_base64: &str, positioned: bool) -> ExportLayer {
        ExportLayer {
            id: id.to_string(),
            name: id.to_string(),
            image_base64: Some(image_base64.to_string()),
            info: positioned.then_some(ExportLayerInfo {
                resolution: 0.05,
                origin: [0.0, 0.0, 0.0],
            }),
            opacity: 1.0,
            blend_mode: "overwrite".to_string(),
            z_index: 0,
            clip: None,
        }
    }

    fn visibility(entries: &[(&str, bool)]) -> HashMap<String, bool> {
        entries.iter().map(|(id, shown)| (id.to_string(), *shown)).collect()
    }

    /// A 1×1 PNG, as base64.
    fn pixel_png() -> String {
        use base64::{engine::general_purpose, Engine as _};
        let mut png = Vec::new();
        image::DynamicImage::ImageLuma8(image::GrayImage::from_pixel(1, 1, image::Luma([0])))
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();
        general_purpose::STANDARD.encode(&png)
    }

    #[test]
    fn only_layers_that_some_region_draws_are_decoded() {
        // Broken images, so that decoding any of them would be reported.
        let layers = [
            layer_with_image("drawn", &pixel_png(), true),
            layer_with_image("hidden_everywhere", "!!broken!!", true),
            layer_with_image("hidden_in_one", "!!broken!!", true),
            layer_with_image("no_position", "!!broken!!", false),
            layer_with_image("drawn_but_broken", "!!broken!!", true),
        ];
        let first = visibility(&[
            ("hidden_everywhere", false),
            ("hidden_in_one", false),
            ("drawn_but_broken", true),
        ]);
        let second = visibility(&[("hidden_everywhere", false)]);
        let reported = std::sync::Mutex::new(Vec::new());

        let decoded = decode_drawn_layers(&layers, &[&first, &second], &|layer, _| {
            reported.lock().unwrap().push(layer.id.clone());
        });

        let ids: Vec<_> = decoded.iter().map(|(layer, _)| layer.id.as_str()).collect();
        assert_eq!(ids, ["drawn"]);
        let mut reported = reported.into_inner().unwrap();
        reported.sort();
        // `hidden_in_one` is drawn by the second region (no entry means shown), so it is read, and fails.
        assert_eq!(reported, ["drawn_but_broken", "hidden_in_one"]);
    }

    #[test]
    fn decoded_layers_keep_the_order_of_the_layers() {
        let png = pixel_png();
        let layers: Vec<_> = (0..40)
            .map(|i| layer_with_image(&format!("layer{i}"), &png, true))
            .collect();
        let shown = visibility(&[]);

        let decoded = decode_drawn_layers(&layers, &[&shown], &|_, _| {});

        let ids: Vec<_> = decoded.iter().map(|(layer, _)| layer.id.clone()).collect();
        let expected: Vec<_> = (0..40).map(|i| format!("layer{i}")).collect();
        assert_eq!(ids, expected);
    }
}
