use super::blending::{blend_layers_to_cells_cancellable, LayerClip, LayerInput, RectRegion};
use super::layer_decode::{decode_layer, ClassifiedLayer, DecodeCache, LayerKey};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::Arc;

/// The error of a preview that stopped early because a newer request replaced it.
pub const PREVIEW_CANCELLED: &str = "cancelled";

#[derive(Debug, Deserialize)]
pub struct BlendPreviewLayer {
    pub id: String,
    pub image_base64: Option<String>,
    pub info: Option<serde_json::Value>,
    pub blend_mode: String,
    pub z_index: i32,
    pub visible: bool,
    #[serde(default)]
    pub clip: Option<LayerClip>,
}

pub struct BlendPreviewResult {
    pub width: u32,
    pub height: u32,
    pub origin: [f64; 3],
    pub resolution: f64,
    /// `width × height` pixels, row by row from the top, 4 bytes (R, G, B, A) each.
    pub rgba: Vec<u8>,
}

/// Size of the header `into_bytes` puts before the pixels.
pub const PREVIEW_HEADER_BYTES: usize = 40;

impl BlendPreviewResult {
    /// The wire format of the preview, all numbers little-endian:
    /// `width: u32`, `height: u32`, `origin: [f64; 3]`, `resolution: f64`, then the RGBA pixels.
    /// Sent as a raw binary response: no JSON, no base64, no image codec in between.
    pub fn into_bytes(self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(PREVIEW_HEADER_BYTES + self.rgba.len());
        bytes.extend_from_slice(&self.width.to_le_bytes());
        bytes.extend_from_slice(&self.height.to_le_bytes());
        for value in self.origin {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        bytes.extend_from_slice(&self.resolution.to_le_bytes());
        bytes.extend_from_slice(&self.rgba);
        bytes
    }
}

/// Blends the visible layers into one occupancy image. `is_cancelled` is polled while the work goes on;
/// once it returns true the preview stops and fails with [`PREVIEW_CANCELLED`], since nobody wants its result.
///
/// Decoded layers are looked up in `cache` when one is given, and only the layers of this preview stay in it
/// afterwards. Without a cache every layer is decoded each time and nothing is kept.
pub fn blend_map_preview(
    layers: Vec<BlendPreviewLayer>,
    cache: Option<&DecodeCache>,
    is_cancelled: &(dyn Fn() -> bool + Sync),
) -> Result<BlendPreviewResult, String> {
    let mut visible: Vec<_> = layers
        .into_iter()
        .filter(|l| l.visible && l.image_base64.is_some())
        .collect();
    visible.sort_by_key(|l| l.z_index);

    if visible.is_empty() {
        return Err("No visible layers".to_string());
    }

    let decoded: Vec<(&BlendPreviewLayer, Option<LayerKey>, Arc<ClassifiedLayer>)> = visible
        .par_iter()
        .map(|layer| {
            if is_cancelled() {
                return Err(PREVIEW_CANCELLED.to_string());
            }
            let b64 = layer.image_base64.as_ref().unwrap();
            let (key, classified) = match cache {
                Some(cache) => cache.decode(b64).map(|(key, classified)| (Some(key), classified)),
                None => decode_layer(b64).map(|classified| (None, Arc::new(classified))),
            }
            .map_err(|e| e.to_string())?;
            Ok((layer, key, classified))
        })
        .collect::<Result<_, String>>()?;

    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    let mut min_resolution = f64::MAX;

    for (layer, _, img) in &decoded {
        let info = layer.info.as_ref();
        let l_res = info
            .and_then(|i| i.get("resolution"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.05);
        let l_orig = info.and_then(|i| i.get("origin")).and_then(|v| v.as_array());
        let l_ox = l_orig
            .as_ref()
            .and_then(|a| a.first())
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let l_oy = l_orig
            .as_ref()
            .and_then(|a| a.get(1))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let l_oyaw = l_orig
            .as_ref()
            .and_then(|a| a.get(2))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

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
            let corners = [(0.0, 0.0), (w_meters, 0.0), (w_meters, h_meters), (0.0, h_meters)];
            for (cx, cy) in corners {
                let wx = l_ox + cx * cos_yaw - cy * sin_yaw;
                let wy = l_oy + cx * sin_yaw + cy * cos_yaw;
                if wx < min_x {
                    min_x = wx;
                }
                if wy < min_y {
                    min_y = wy;
                }
                if wx > max_x {
                    max_x = wx;
                }
                if wy > max_y {
                    max_y = wy;
                }
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
    for (layer, _, img) in &decoded {
        let info = layer.info.as_ref();
        let l_res = info
            .and_then(|i| i.get("resolution"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.05);
        let l_orig = info.and_then(|i| i.get("origin")).and_then(|v| v.as_array());
        let l_ox = l_orig
            .as_ref()
            .and_then(|a| a.first())
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let l_oy = l_orig
            .as_ref()
            .and_then(|a| a.get(1))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let l_oyaw = l_orig
            .as_ref()
            .and_then(|a| a.get(2))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        layer_inputs.push(LayerInput {
            id: &layer.id,
            image: img.as_ref(),
            resolution: l_res,
            origin: [l_ox, l_oy, l_oyaw],
            blend_mode: &layer.blend_mode,
            z_index: layer.z_index,
            clip: layer.clip.as_ref(),
        });
    }

    let region = RectRegion {
        x: min_x,
        y: min_y,
        width: out_w as f64 * resolution,
        height: out_h as f64 * resolution,
    };

    let blended = blend_layers_to_cells_cancellable(&layer_inputs, &region, resolution, is_cancelled)
        .ok_or_else(|| PREVIEW_CANCELLED.to_string())?;

    // A preview that stopped early never gets here, so it cannot evict what the newer preview is using.
    if let Some(cache) = cache {
        let used: HashSet<LayerKey> = decoded.iter().filter_map(|(_, key, _)| *key).collect();
        cache.retain_only(&used);
    }

    Ok(BlendPreviewResult {
        width: blended.width,
        height: blended.height,
        origin: [min_x, min_y, 0.0],
        resolution,
        rgba: blended.to_rgba_image().into_raw(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose, Engine as _};
    use image::{DynamicImage, GrayImage, ImageFormat, Luma};

    /// A 4×4 picture: a wall along the given row, free space elsewhere.
    fn room_png_b64(wall_row: u32) -> String {
        let room = GrayImage::from_fn(4, 4, |_, y| Luma([if y == wall_row { 0 } else { 254 }]));
        let mut png = Vec::new();
        DynamicImage::ImageLuma8(room)
            .write_to(&mut std::io::Cursor::new(&mut png), ImageFormat::Png)
            .unwrap();
        general_purpose::STANDARD.encode(&png)
    }

    fn room_layer(visible: bool) -> BlendPreviewLayer {
        room_layer_with_wall_at(0, visible)
    }

    fn room_layer_with_wall_at(wall_row: u32, visible: bool) -> BlendPreviewLayer {
        BlendPreviewLayer {
            id: format!("room{wall_row}"),
            image_base64: Some(format!("data:image/png;base64,{}", room_png_b64(wall_row))),
            info: Some(serde_json::json!({ "resolution": 1.0, "origin": [2.0, 3.0, 0.0] })),
            blend_mode: "overwrite".to_string(),
            z_index: 0,
            visible,
            clip: None,
        }
    }

    fn u32_at(bytes: &[u8], at: usize) -> u32 {
        u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
    }

    fn f64_at(bytes: &[u8], at: usize) -> f64 {
        f64::from_le_bytes(bytes[at..at + 8].try_into().unwrap())
    }

    #[test]
    fn the_preview_is_a_header_followed_by_the_occupancy_pixels() {
        let bytes = blend_map_preview(vec![room_layer(true)], None, &|| false)
            .unwrap()
            .into_bytes();

        assert_eq!((u32_at(&bytes, 0), u32_at(&bytes, 4)), (4, 4));
        assert_eq!(
            [f64_at(&bytes, 8), f64_at(&bytes, 16), f64_at(&bytes, 24)],
            [2.0, 3.0, 0.0]
        );
        assert_eq!(f64_at(&bytes, 32), 1.0);
        let pixels = &bytes[PREVIEW_HEADER_BYTES..];
        assert_eq!(pixels.len(), 4 * 4 * 4);
        let (wall, free) = ([0, 0, 0, 255], [254, 254, 254, 255]);
        for (i, pixel) in pixels.chunks_exact(4).enumerate() {
            assert_eq!(pixel, if i < 4 { wall } else { free }, "pixel {i}");
        }
    }

    #[test]
    fn a_preview_that_a_newer_request_replaced_fails_as_cancelled() {
        let error = blend_map_preview(vec![room_layer(true)], None, &|| true).err().unwrap();

        assert_eq!(error, PREVIEW_CANCELLED);
    }

    #[test]
    fn hidden_layers_are_not_drawn() {
        let error = blend_map_preview(vec![room_layer(false)], None, &|| false)
            .err()
            .unwrap();

        assert_eq!(error, "No visible layers");
    }

    fn preview_bytes(wall_row: u32, cache: Option<&DecodeCache>) -> Vec<u8> {
        blend_map_preview(vec![room_layer_with_wall_at(wall_row, true)], cache, &|| false)
            .unwrap()
            .into_bytes()
    }

    #[test]
    fn a_cached_preview_looks_the_same_as_an_uncached_one() {
        let cache = DecodeCache::default();

        let first = preview_bytes(0, Some(&cache));
        let again = preview_bytes(0, Some(&cache));

        assert_eq!(first, preview_bytes(0, None));
        assert_eq!(again, first);
    }

    #[test]
    fn the_cache_follows_the_images_of_the_latest_preview() {
        let cache = DecodeCache::default();

        let before_the_edit = preview_bytes(0, Some(&cache));
        assert_eq!(cache.len(), 1);
        // The map was edited: the wall moved. The new picture is blended, not the cached old one.
        let after_the_edit = preview_bytes(2, Some(&cache));

        assert_ne!(after_the_edit, before_the_edit);
        assert_eq!(after_the_edit, preview_bytes(2, None));
        assert_eq!(cache.len(), 1, "the old picture was let go");
    }

    #[test]
    fn a_preview_without_a_cache_leaves_the_cache_alone() {
        let cache = DecodeCache::default();
        preview_bytes(0, Some(&cache));

        preview_bytes(2, None);

        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn a_cancelled_preview_does_not_evict_what_the_newer_one_uses() {
        let cache = DecodeCache::default();
        preview_bytes(0, Some(&cache));

        let cancelled = blend_map_preview(vec![room_layer_with_wall_at(2, true)], Some(&cache), &|| true);

        assert_eq!(cancelled.err().as_deref(), Some(PREVIEW_CANCELLED));
        assert_eq!(cache.len(), 1);
        assert_eq!(preview_bytes(0, Some(&cache)), preview_bytes(0, None));
    }

    #[test]
    fn clearing_the_cache_lets_go_of_every_picture() {
        let cache = DecodeCache::default();
        preview_bytes(0, Some(&cache));

        cache.clear();

        assert!(cache.is_empty());
        assert_eq!(preview_bytes(0, Some(&cache)), preview_bytes(0, None));
    }

    #[test]
    fn a_broken_image_is_reported_by_the_step_that_failed() {
        let mut layer = room_layer(true);
        layer.image_base64 = Some("!!not base64!!".to_string());

        let error = blend_map_preview(vec![layer], None, &|| false).err().unwrap();

        assert!(error.starts_with("Base64 decode error"), "{error}");
    }
}

#[cfg(test)]
mod bench {
    use super::super::blending::blend_layers_to_cells;
    use super::*;
    use base64::{engine::general_purpose, Engine as _};
    use image::{DynamicImage, ImageFormat, Luma};
    use std::time::Instant;

    /// Map-like picture: free space with walls and unknown regions, so the PNG compresses like a real map.
    fn map_png_b64(size: u32, seed: u32) -> String {
        let img = image::GrayImage::from_fn(size, size, |x, y| {
            // Sensor-like speckle, so the PNG is about as large as a scanned map's.
            let speckle =
                (x.wrapping_mul(2_654_435_761) ^ y.wrapping_mul(40_503) ^ seed).wrapping_mul(2_246_822_519) >> 28 == 0;
            let wall = speckle || (x / 97 + y / 61 + seed).is_multiple_of(7);
            let unknown = (x / 400 + y / 300 + seed).is_multiple_of(5);
            Luma([if wall {
                0
            } else if unknown {
                205
            } else {
                254
            }])
        });
        let mut png = Vec::new();
        DynamicImage::ImageLuma8(img)
            .write_to(&mut std::io::Cursor::new(&mut png), ImageFormat::Png)
            .unwrap();
        format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(&png))
    }

    fn layer(id: &str, size: u32, seed: u32, origin: serde_json::Value, mode: &str, z: i32) -> BlendPreviewLayer {
        BlendPreviewLayer {
            id: id.to_string(),
            image_base64: Some(map_png_b64(size, seed)),
            info: Some(serde_json::json!({ "resolution": 0.05, "origin": origin })),
            blend_mode: mode.to_string(),
            z_index: z,
            visible: true,
            clip: None,
        }
    }

    fn timed<T>(label: &str, f: impl FnOnce() -> T) -> T {
        let start = Instant::now();
        let value = f();
        println!("{label:<28} {:>8.1} ms", start.elapsed().as_secs_f64() * 1000.0);
        value
    }

    /// Per-stage timings of one preview. Run with:
    /// `cargo test --release blend_preview_stage_timings -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn blend_preview_stage_timings() {
        let layers = || {
            vec![
                layer("a", 4000, 0, serde_json::json!([0.0, 0.0, 0.0]), "overwrite", 0),
                layer("b", 3000, 1, serde_json::json!([50.0, 30.0, 0.3]), "merge_obstacles", 1),
            ]
        };

        let input = layers();
        let b64_bytes: usize = input.iter().map(|l| l.image_base64.as_ref().unwrap().len()).sum();
        println!("payload (base64)             {:>8.1} MB", b64_bytes as f64 / 1e6);

        let decoded: Vec<_> = timed("decode + classify (parallel)", || {
            input
                .par_iter()
                .map(|l| decode_layer(l.image_base64.as_ref().unwrap()).unwrap())
                .collect()
        });

        let region = RectRegion {
            x: 0.0,
            y: 0.0,
            width: 250.0,
            height: 250.0,
        };
        let inputs: Vec<_> = decoded
            .iter()
            .zip(&input)
            .map(|(img, l)| {
                let origin = l.info.as_ref().unwrap()["origin"].as_array().unwrap();
                LayerInput {
                    id: &l.id,
                    image: img,
                    resolution: 0.05,
                    origin: [
                        origin[0].as_f64().unwrap(),
                        origin[1].as_f64().unwrap(),
                        origin[2].as_f64().unwrap(),
                    ],
                    blend_mode: &l.blend_mode,
                    z_index: l.z_index,
                    clip: None,
                }
            })
            .collect();
        let blended = timed("blend (25 MP output)", || blend_layers_to_cells(&inputs, &region, 0.05));
        timed("RGBA bytes", || blended.to_rgba_image());

        let result = timed("blend_map_preview (total)", || {
            blend_map_preview(layers(), None, &|| false).unwrap()
        });
        println!(
            "result (binary)              {:>8.1} MB",
            result.into_bytes().len() as f64 / 1e6
        );
    }
}
