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
    let gray = (rgba[0] as f64 * 0.299 + rgba[1] as f64 * 0.587 + rgba[2] as f64 * 0.114) as u8;
    if gray < 128 {
        CellValue::Obstacle
    } else if gray > 230 {
        CellValue::Free
    } else {
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

        for r in 0..out_h {
            for c in 0..out_w {
                let world_x = region.x + (c as f64) * output_resolution;
                let world_y = region.y + ((out_h - 1 - r) as f64) * output_resolution;

                let c_l = ((world_x - layer.origin[0]) / layer.resolution).round() as i32;
                let r_l = (l_h - 1.0 - (world_y - layer.origin[1]) / layer.resolution).round() as i32;

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
}
