use image::{RgbaImage, Rgba, DynamicImage, GenericImageView};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CellValue {
    Unknown,
    Free,
    Obstacle,
}

impl CellValue {
    pub fn to_rgba(self) -> Rgba<u8> {
        match self {
            CellValue::Obstacle => Rgba([0, 0, 0, 255]),
            CellValue::Free     => Rgba([254, 254, 254, 255]),
            CellValue::Unknown  => Rgba([205, 205, 205, 255]),
        }
    }

    pub fn to_occupancy_grid_val(self) -> i8 {
        match self {
            CellValue::Obstacle => 100,
            CellValue::Free     => 0,
            CellValue::Unknown  => -1,
        }
    }
}

/// RGBAピクセルを Unknown / Free / Obstacle に3値判定
pub fn classify_pixel(rgba: [u8; 4]) -> CellValue {
    if rgba[3] < 128 {
        return CellValue::Unknown;
    }
    let gray = (rgba[0] as f64 * 0.299 + rgba[1] as f64 * 0.587 + rgba[2] as f64 * 0.114).round() as u8;
    if gray <= 89 {
        CellValue::Obstacle
    } else if gray >= 230 {
        CellValue::Free
    } else {
        // Includes 205 (0xCD) and all intermediate values
        CellValue::Unknown
    }
}

/// 2つのセル値とブレンドモードから合成後のセル値を算出
pub fn apply_blend_cell(current: CellValue, incoming: CellValue, blend_mode: &str) -> CellValue {
    match blend_mode {
        "merge_obstacles" => {
            if incoming == CellValue::Obstacle || current == CellValue::Obstacle {
                CellValue::Obstacle
            } else if incoming == CellValue::Free || current == CellValue::Free {
                CellValue::Free
            } else {
                CellValue::Unknown
            }
        }
        "merge_free" => {
            if incoming == CellValue::Free || current == CellValue::Free {
                CellValue::Free
            } else if incoming == CellValue::Obstacle || current == CellValue::Obstacle {
                CellValue::Obstacle
            } else {
                CellValue::Unknown
            }
        }
        _ => { // "overwrite"
            if incoming != CellValue::Unknown {
                incoming
            } else {
                current
            }
        }
    }
}

pub struct LayerInput<'a> {
    pub id: &'a str,
    pub image: &'a DynamicImage,
    pub resolution: f64,
    pub origin: [f64; 3],
    pub blend_mode: &'a str,
    pub z_index: i32,
}

pub struct RectRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// レイヤー群を指定されたワールド矩形領域に共通アルゴリズムで合成描画
pub fn blend_layers_to_image(
    layers: &[LayerInput],
    region: &RectRegion,
    output_resolution: f64,
) -> RgbaImage {
    let out_w = (region.width / output_resolution).round() as u32;
    let out_h = (region.height / output_resolution).round() as u32;

    if out_w == 0 || out_h == 0 {
        return RgbaImage::new(0, 0);
    }

    let mut sorted_layers: Vec<_> = layers.iter().collect();
    sorted_layers.sort_by_key(|l| l.z_index);

    let mut out_img = RgbaImage::from_pixel(out_w, out_h, CellValue::Unknown.to_rgba());
    let mut cell_state = vec![CellValue::Unknown; (out_w * out_h) as usize];

    for layer in sorted_layers {
        let l_w = layer.image.width() as f64;
        let l_h = layer.image.height() as f64;
        let yaw = layer.origin[2];
        let has_yaw = yaw.abs() >= 1e-9;
        let (cos_yaw, sin_yaw) = if has_yaw {
            (yaw.cos(), yaw.sin())
        } else {
            (1.0, 0.0)
        };

        for r in 0..out_h {
            for c in 0..out_w {
                let world_x = region.x + (c as f64) * output_resolution;
                let world_y = region.y + ((out_h - 1 - r) as f64) * output_resolution;

                let dx = world_x - layer.origin[0];
                let dy = world_y - layer.origin[1];

                let (lx, ly) = if has_yaw {
                    (dx * cos_yaw + dy * sin_yaw, -dx * sin_yaw + dy * cos_yaw)
                } else {
                    (dx, dy)
                };

                let c_l = (lx / layer.resolution).round() as i32;
                let r_l = (l_h - 1.0 - ly / layer.resolution).round() as i32;

                if c_l < 0 || c_l >= l_w as i32 || r_l < 0 || r_l >= l_h as i32 {
                    continue;
                }

                let px = layer.image.get_pixel(c_l as u32, r_l as u32).0;
                let incoming = classify_pixel(px);

                let idx = (r * out_w + c) as usize;
                let new_cell = apply_blend_cell(cell_state[idx], incoming, layer.blend_mode);
                cell_state[idx] = new_cell;
                *out_img.get_pixel_mut(c, r) = new_cell.to_rgba();
            }
        }
    }

    out_img
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_pixel() {
        assert_eq!(classify_pixel([0, 0, 0, 255]), CellValue::Obstacle);
        assert_eq!(classify_pixel([255, 255, 255, 255]), CellValue::Free);
        assert_eq!(classify_pixel([205, 205, 205, 255]), CellValue::Unknown);
        assert_eq!(classify_pixel([0, 0, 0, 0]), CellValue::Unknown);
    }

    #[test]
    fn test_apply_blend_cell() {
        // overwrite
        assert_eq!(apply_blend_cell(CellValue::Unknown, CellValue::Obstacle, "overwrite"), CellValue::Obstacle);
        assert_eq!(apply_blend_cell(CellValue::Obstacle, CellValue::Unknown, "overwrite"), CellValue::Obstacle);
        assert_eq!(apply_blend_cell(CellValue::Obstacle, CellValue::Free, "overwrite"), CellValue::Free);

        // merge_obstacles
        assert_eq!(apply_blend_cell(CellValue::Free, CellValue::Obstacle, "merge_obstacles"), CellValue::Obstacle);
        assert_eq!(apply_blend_cell(CellValue::Obstacle, CellValue::Free, "merge_obstacles"), CellValue::Obstacle);
        assert_eq!(apply_blend_cell(CellValue::Unknown, CellValue::Free, "merge_obstacles"), CellValue::Free);

        // merge_free
        assert_eq!(apply_blend_cell(CellValue::Obstacle, CellValue::Free, "merge_free"), CellValue::Free);
        assert_eq!(apply_blend_cell(CellValue::Free, CellValue::Obstacle, "merge_free"), CellValue::Free);
        assert_eq!(apply_blend_cell(CellValue::Unknown, CellValue::Obstacle, "merge_free"), CellValue::Obstacle);
    }

    #[test]
    fn test_blend_with_yaw_rotation() {
        use std::f64::consts::PI;

        // Create a 2x2 image:
        // row 0: [Obstacle, Free]
        // row 1: [Free, Free]
        let mut img = RgbaImage::new(2, 2);
        // row 0 (top in image coords)
        img.put_pixel(0, 0, CellValue::Obstacle.to_rgba());
        img.put_pixel(1, 0, CellValue::Free.to_rgba());
        // row 1 (bottom in image coords, which is ly=0 in world coords)
        img.put_pixel(0, 1, CellValue::Free.to_rgba());
        img.put_pixel(1, 1, CellValue::Free.to_rgba());

        let dyn_img = DynamicImage::ImageRgba8(img);

        // Layer with 90 degree counter-clockwise rotation (PI / 2)
        // origin at (0, 0, PI/2), resolution = 1.0
        // When rotated 90 deg CCW:
        // Bottom-left pixel (c=0, r=1, ly=0, lx=0) is at world (0, 0).
        // Top-left pixel (c=0, r=0, ly=1, lx=0) has world:
        // dx = -1 * sin(PI/2) = -1, dy = 1 * cos(PI/2) = 0 -> world (-1, 0)
        let layer = LayerInput {
            id: "rot_layer",
            image: &dyn_img,
            resolution: 1.0,
            origin: [0.0, 0.0, PI / 2.0],
            blend_mode: "overwrite",
            z_index: 0,
        };

        let region = RectRegion {
            x: -2.0,
            y: 0.0,
            width: 2.0,
            height: 2.0,
        };

        let result = blend_layers_to_image(&[layer], &region, 1.0);
        assert_eq!(result.width(), 2);
        assert_eq!(result.height(), 2);

        // World (-1.0, 0.0) corresponds to region x=-2 + 1*1.0 = -1, y=0 (row 1, col 1 in 2x2 output)
        // Check pixel at (c=1, r=1) which is world (-1.0, 0.0) -> top-left of original image (Obstacle)
        let px = result.get_pixel(1, 1).0;
        assert_eq!(classify_pixel(px), CellValue::Obstacle);
    }
}
