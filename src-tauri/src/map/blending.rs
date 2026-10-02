use image::{DynamicImage, GenericImageView, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};

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
            CellValue::Free => Rgba([254, 254, 254, 255]),
            CellValue::Unknown => Rgba([205, 205, 205, 255]),
        }
    }

    pub fn to_occupancy_grid_val(self) -> i8 {
        match self {
            CellValue::Obstacle => 100,
            CellValue::Free => 0,
            CellValue::Unknown => -1,
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
    BlendMode::parse(blend_mode).apply(current, incoming)
}

/// ブレンドモード。文字列はレイヤーごとに 1 回だけ解釈する（画素ごとに文字列比較しない）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BlendMode {
    MergeObstacles,
    MergeFree,
    Replace,
    /// 未知の文字列も overwrite として扱う。
    Overwrite,
}

impl BlendMode {
    fn parse(blend_mode: &str) -> Self {
        match blend_mode {
            "merge_obstacles" => BlendMode::MergeObstacles,
            "merge_free" => BlendMode::MergeFree,
            "replace" => BlendMode::Replace,
            _ => BlendMode::Overwrite,
        }
    }

    #[inline]
    fn apply(self, current: CellValue, incoming: CellValue) -> CellValue {
        match self {
            BlendMode::MergeObstacles => {
                if incoming == CellValue::Obstacle || current == CellValue::Obstacle {
                    CellValue::Obstacle
                } else if incoming == CellValue::Free || current == CellValue::Free {
                    CellValue::Free
                } else {
                    CellValue::Unknown
                }
            }
            BlendMode::MergeFree => {
                if incoming == CellValue::Free || current == CellValue::Free {
                    CellValue::Free
                } else if incoming == CellValue::Obstacle || current == CellValue::Obstacle {
                    CellValue::Obstacle
                } else {
                    CellValue::Unknown
                }
            }
            // Unknown from the layer replaces the cell as well; a layer without data at a cell never reaches here.
            BlendMode::Replace => incoming,
            BlendMode::Overwrite => {
                if incoming != CellValue::Unknown {
                    incoming
                } else {
                    current
                }
            }
        }
    }
}

/// レイヤー画像の画素を RGBA で読む。`DynamicImage::get_pixel` は画素ごとに形式の判定と色変換を行うため、
/// 変換が自明な 8bit 形式は具体型のバッファから直接組み立てる（結果は `get_pixel` と同一）。
enum PixelSource<'a> {
    L8(&'a image::GrayImage),
    La8(&'a image::GrayAlphaImage),
    Rgb8(&'a image::RgbImage),
    Rgba8(&'a RgbaImage),
    Other(&'a DynamicImage),
}

impl<'a> PixelSource<'a> {
    fn new(image: &'a DynamicImage) -> Self {
        match image {
            DynamicImage::ImageLuma8(img) => PixelSource::L8(img),
            DynamicImage::ImageLumaA8(img) => PixelSource::La8(img),
            DynamicImage::ImageRgb8(img) => PixelSource::Rgb8(img),
            DynamicImage::ImageRgba8(img) => PixelSource::Rgba8(img),
            other => PixelSource::Other(other),
        }
    }

    #[inline]
    fn rgba(&self, x: u32, y: u32) -> [u8; 4] {
        match self {
            PixelSource::L8(img) => {
                let [l] = img.get_pixel(x, y).0;
                [l, l, l, 255]
            }
            PixelSource::La8(img) => {
                let [l, a] = img.get_pixel(x, y).0;
                [l, l, l, a]
            }
            PixelSource::Rgb8(img) => {
                let [r, g, b] = img.get_pixel(x, y).0;
                [r, g, b, 255]
            }
            PixelSource::Rgba8(img) => img.get_pixel(x, y).0,
            PixelSource::Other(img) => img.get_pixel(x, y).0,
        }
    }
}

/// ワールド座標 (m) の矩形。`x`/`y` は最小コーナー (Y 上向き)。
/// 半開区間 [x, x+width) × [y, y+height) を表すため、辺を共有する 2 つの矩形は重ならず隙間も生じない。
#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
pub struct ClipRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// レイヤーのうち合成に参加する範囲 (矩形の和集合)。
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LayerClip {
    pub rects: Vec<ClipRect>,
}

impl LayerClip {
    pub fn contains(&self, world_x: f64, world_y: f64) -> bool {
        self.rects
            .iter()
            .any(|r| world_x >= r.x && world_x < r.x + r.width && world_y >= r.y && world_y < r.y + r.height)
    }
}

pub struct LayerInput<'a> {
    pub id: &'a str,
    pub image: &'a DynamicImage,
    pub resolution: f64,
    pub origin: [f64; 3],
    pub blend_mode: &'a str,
    pub z_index: i32,
    /// `None` はレイヤー全体を使う。
    pub clip: Option<&'a LayerClip>,
}

pub struct RectRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// レイヤー群を指定されたワールド矩形領域に共通アルゴリズムで合成描画
pub fn blend_layers_to_image(layers: &[LayerInput], region: &RectRegion, output_resolution: f64) -> RgbaImage {
    let out_w = (region.width / output_resolution).round() as u32;
    let out_h = (region.height / output_resolution).round() as u32;

    if out_w == 0 || out_h == 0 {
        return RgbaImage::new(0, 0);
    }

    let mut sorted_layers: Vec<_> = layers.iter().collect();
    sorted_layers.sort_by_key(|l| l.z_index);

    let mut cell_state = vec![CellValue::Unknown; (out_w * out_h) as usize];

    for layer in sorted_layers {
        let l_w = layer.image.width() as f64;
        let l_h = layer.image.height() as f64;
        let yaw = layer.origin[2];
        let has_yaw = yaw.abs() >= 1e-9;
        let (cos_yaw, sin_yaw) = if has_yaw { (yaw.cos(), yaw.sin()) } else { (1.0, 0.0) };
        let pixels = PixelSource::new(layer.image);
        let blend_mode = BlendMode::parse(layer.blend_mode);

        let Some((c0, c1, r0, r1)) = layer_output_range(
            layer,
            region,
            output_resolution,
            out_w,
            out_h,
            (cos_yaw, sin_yaw),
            has_yaw,
        ) else {
            continue;
        };

        for r in r0..=r1 {
            for c in c0..=c1 {
                let world_x = region.x + (c as f64) * output_resolution;
                let world_y = region.y + ((out_h - 1 - r) as f64) * output_resolution;

                if let Some(clip) = layer.clip {
                    if !clip.contains(world_x, world_y) {
                        continue;
                    }
                }

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

                let px = pixels.rgba(c_l as u32, r_l as u32);
                // Transparent pixels carry no data (custom layers are rasterized on a transparent
                // background), so they never take part in blending, whatever the blend mode.
                if px[3] < 128 {
                    continue;
                }
                let incoming = classify_pixel(px);

                let idx = (r * out_w + c) as usize;
                cell_state[idx] = blend_mode.apply(cell_state[idx], incoming);
            }
        }
    }

    let mut out_img = RgbaImage::new(out_w, out_h);
    for (px, cell) in out_img.pixels_mut().zip(&cell_state) {
        *px = cell.to_rgba();
    }
    out_img
}

/// 出力画像のうち、レイヤー画像の画素に当たり得る列・行の範囲 `(c0, c1, r0, r1)`（両端を含む）。
/// `None` はどの画素にも当たらないこと（レイヤーが空、または出力範囲の外）を表す。
///
/// 画素ごとの範囲判定は呼び出し側で従来どおり行うので、ここでは取りこぼしのない外接矩形を返せばよい。
/// 判定を通る画素はレイヤー座標で `lx/res ∈ [-0.5, w-0.5]`、`ly/res ∈ [-0.5, h-0.5]` に収まるため、
/// その 4 隅をワールド座標へ戻した外接矩形に、丸め誤差を吸収する余白を付けて出力の行・列へ変換する。
/// 解像度が 0 や非有限などで矩形が求まらない場合は、従来と同じ結果になるよう全範囲を返す。
fn layer_output_range(
    layer: &LayerInput,
    region: &RectRegion,
    output_resolution: f64,
    out_w: u32,
    out_h: u32,
    (cos_yaw, sin_yaw): (f64, f64),
    has_yaw: bool,
) -> Option<(u32, u32, u32, u32)> {
    const MARGIN_PX: f64 = 2.0;
    let full = Some((0, out_w - 1, 0, out_h - 1));

    let (l_w, l_h) = (layer.image.width() as f64, layer.image.height() as f64);
    if l_w == 0.0 || l_h == 0.0 {
        return None;
    }
    let res = layer.resolution;
    if res == 0.0 || !res.is_finite() || !output_resolution.is_finite() || output_resolution <= 0.0 {
        return full;
    }

    let (mut min_x, mut max_x, mut min_y, mut max_y) =
        (f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY);
    for lx in [-0.5 * res, (l_w - 0.5) * res] {
        for ly in [-0.5 * res, (l_h - 0.5) * res] {
            // Inverse of the world → layer transform used per pixel.
            let (dx, dy) = if has_yaw {
                (lx * cos_yaw - ly * sin_yaw, lx * sin_yaw + ly * cos_yaw)
            } else {
                (lx, ly)
            };
            let (wx, wy) = (layer.origin[0] + dx, layer.origin[1] + dy);
            min_x = min_x.min(wx);
            max_x = max_x.max(wx);
            min_y = min_y.min(wy);
            max_y = max_y.max(wy);
        }
    }
    if ![min_x, max_x, min_y, max_y].iter().all(|v| v.is_finite()) {
        return full;
    }

    // Column c samples world_x = region.x + c·res_out; row r samples world_y = region.y + (out_h-1-r)·res_out.
    let c_lo = ((min_x - region.x) / output_resolution).floor() - MARGIN_PX;
    let c_hi = ((max_x - region.x) / output_resolution).ceil() + MARGIN_PX;
    let k_lo = ((min_y - region.y) / output_resolution).floor() - MARGIN_PX;
    let k_hi = ((max_y - region.y) / output_resolution).ceil() + MARGIN_PX;
    let (last_c, last_k) = ((out_w - 1) as f64, (out_h - 1) as f64);
    if c_hi < 0.0 || c_lo > last_c || k_hi < 0.0 || k_lo > last_k {
        return None;
    }

    let (c0, c1) = (c_lo.max(0.0) as u32, c_hi.min(last_c) as u32);
    let (k0, k1) = (k_lo.max(0.0) as u32, k_hi.min(last_k) as u32);
    Some((c0, c1, out_h - 1 - k1, out_h - 1 - k0))
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
        assert_eq!(
            apply_blend_cell(CellValue::Unknown, CellValue::Obstacle, "overwrite"),
            CellValue::Obstacle
        );
        assert_eq!(
            apply_blend_cell(CellValue::Obstacle, CellValue::Unknown, "overwrite"),
            CellValue::Obstacle
        );
        assert_eq!(
            apply_blend_cell(CellValue::Obstacle, CellValue::Free, "overwrite"),
            CellValue::Free
        );

        // replace
        assert_eq!(
            apply_blend_cell(CellValue::Obstacle, CellValue::Unknown, "replace"),
            CellValue::Unknown
        );
        assert_eq!(
            apply_blend_cell(CellValue::Obstacle, CellValue::Free, "replace"),
            CellValue::Free
        );

        // merge_obstacles
        assert_eq!(
            apply_blend_cell(CellValue::Free, CellValue::Obstacle, "merge_obstacles"),
            CellValue::Obstacle
        );
        assert_eq!(
            apply_blend_cell(CellValue::Obstacle, CellValue::Free, "merge_obstacles"),
            CellValue::Obstacle
        );
        assert_eq!(
            apply_blend_cell(CellValue::Unknown, CellValue::Free, "merge_obstacles"),
            CellValue::Free
        );

        // merge_free
        assert_eq!(
            apply_blend_cell(CellValue::Obstacle, CellValue::Free, "merge_free"),
            CellValue::Free
        );
        assert_eq!(
            apply_blend_cell(CellValue::Free, CellValue::Obstacle, "merge_free"),
            CellValue::Free
        );
        assert_eq!(
            apply_blend_cell(CellValue::Unknown, CellValue::Obstacle, "merge_free"),
            CellValue::Obstacle
        );
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
            clip: None,
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

    fn solid_image(size: u32, cell: CellValue) -> DynamicImage {
        DynamicImage::ImageRgba8(RgbaImage::from_pixel(size, size, cell.to_rgba()))
    }

    fn cell_at(img: &RgbaImage, col: u32, row: u32) -> CellValue {
        classify_pixel(img.get_pixel(col, row).0)
    }

    fn clip_of(x: f64, y: f64, width: f64, height: f64) -> LayerClip {
        LayerClip {
            rects: vec![ClipRect { x, y, width, height }],
        }
    }

    #[test]
    fn clipped_layers_contribute_only_inside_their_clip() {
        // 4x4 m region at 1 m/px. map1 (all obstacle) keeps only the left half,
        // map2 (all free) keeps only the right half.
        let obstacles = solid_image(4, CellValue::Obstacle);
        let free = solid_image(4, CellValue::Free);
        let left = clip_of(0.0, 0.0, 2.0, 4.0);
        let right = clip_of(2.0, 0.0, 2.0, 4.0);
        let layers = [
            LayerInput {
                id: "map1",
                image: &obstacles,
                resolution: 1.0,
                origin: [0.0, 0.0, 0.0],
                blend_mode: "overwrite",
                z_index: 0,
                clip: Some(&left),
            },
            LayerInput {
                id: "map2",
                image: &free,
                resolution: 1.0,
                origin: [0.0, 0.0, 0.0],
                blend_mode: "overwrite",
                z_index: 1,
                clip: Some(&right),
            },
        ];
        let region = RectRegion {
            x: 0.0,
            y: 0.0,
            width: 4.0,
            height: 4.0,
        };

        let out = blend_layers_to_image(&layers, &region, 1.0);

        for row in 0..4 {
            assert_eq!(cell_at(&out, 0, row), CellValue::Obstacle);
            assert_eq!(cell_at(&out, 1, row), CellValue::Obstacle);
            assert_eq!(cell_at(&out, 2, row), CellValue::Free);
            assert_eq!(cell_at(&out, 3, row), CellValue::Free);
        }
    }

    #[test]
    fn clip_of_several_rects_forms_an_l_shape() {
        let obstacles = solid_image(4, CellValue::Obstacle);
        let l_shape = LayerClip {
            rects: vec![
                ClipRect {
                    x: 0.0,
                    y: 0.0,
                    width: 2.0,
                    height: 4.0,
                },
                ClipRect {
                    x: 2.0,
                    y: 0.0,
                    width: 2.0,
                    height: 2.0,
                },
            ],
        };
        let layers = [LayerInput {
            id: "map",
            image: &obstacles,
            resolution: 1.0,
            origin: [0.0, 0.0, 0.0],
            blend_mode: "overwrite",
            z_index: 0,
            clip: Some(&l_shape),
        }];
        let region = RectRegion {
            x: 0.0,
            y: 0.0,
            width: 4.0,
            height: 4.0,
        };

        let out = blend_layers_to_image(&layers, &region, 1.0);

        // Row 0 is the top of the region (world y = 3), row 3 the bottom (world y = 0).
        assert_eq!(cell_at(&out, 0, 0), CellValue::Obstacle); // upper left: inside the tall rect
        assert_eq!(cell_at(&out, 3, 0), CellValue::Unknown); // upper right: outside the L
        assert_eq!(cell_at(&out, 3, 3), CellValue::Obstacle); // lower right: inside the short rect
    }

    fn layer_with<'a>(
        id: &'a str,
        image: &'a DynamicImage,
        blend_mode: &'a str,
        z_index: i32,
        clip: Option<&'a LayerClip>,
    ) -> LayerInput<'a> {
        LayerInput {
            id,
            image,
            resolution: 1.0,
            origin: [0.0, 0.0, 0.0],
            blend_mode,
            z_index,
            clip,
        }
    }

    fn region_of(size: f64) -> RectRegion {
        RectRegion {
            x: 0.0,
            y: 0.0,
            width: size,
            height: size,
        }
    }

    #[test]
    fn replace_layer_overwrites_cells_below_with_its_unknown_cells() {
        let obstacles = solid_image(2, CellValue::Obstacle);
        let unknown = solid_image(2, CellValue::Unknown);
        let layers = [
            layer_with("base", &obstacles, "overwrite", 0, None),
            layer_with("top", &unknown, "replace", 1, None),
        ];

        let out = blend_layers_to_image(&layers, &region_of(2.0), 1.0);

        assert_eq!(cell_at(&out, 0, 0), CellValue::Unknown);
        assert_eq!(cell_at(&out, 1, 1), CellValue::Unknown);
    }

    #[test]
    fn overwrite_layer_keeps_cells_below_where_it_is_unknown() {
        let obstacles = solid_image(2, CellValue::Obstacle);
        let unknown = solid_image(2, CellValue::Unknown);
        let layers = [
            layer_with("base", &obstacles, "overwrite", 0, None),
            layer_with("top", &unknown, "overwrite", 1, None),
        ];

        let out = blend_layers_to_image(&layers, &region_of(2.0), 1.0);

        assert_eq!(cell_at(&out, 0, 0), CellValue::Obstacle);
    }

    #[test]
    fn transparent_pixels_leave_cells_below_untouched_even_when_replacing() {
        let obstacles = solid_image(2, CellValue::Obstacle);
        let transparent = DynamicImage::ImageRgba8(RgbaImage::from_pixel(2, 2, Rgba([0, 0, 0, 0])));
        let layers = [
            layer_with("base", &obstacles, "overwrite", 0, None),
            layer_with("top", &transparent, "replace", 1, None),
        ];

        let out = blend_layers_to_image(&layers, &region_of(2.0), 1.0);

        assert_eq!(cell_at(&out, 0, 0), CellValue::Obstacle);
        assert_eq!(cell_at(&out, 1, 1), CellValue::Obstacle);
    }

    #[test]
    fn replace_layer_leaves_cells_outside_its_clip_untouched() {
        let obstacles = solid_image(4, CellValue::Obstacle);
        let unknown = solid_image(4, CellValue::Unknown);
        let left = clip_of(0.0, 0.0, 2.0, 4.0);
        let layers = [
            layer_with("base", &obstacles, "overwrite", 0, None),
            layer_with("top", &unknown, "replace", 1, Some(&left)),
        ];

        let out = blend_layers_to_image(&layers, &region_of(4.0), 1.0);

        assert_eq!(cell_at(&out, 0, 0), CellValue::Unknown);
        assert_eq!(cell_at(&out, 3, 0), CellValue::Obstacle);
    }

    #[test]
    fn layers_without_a_clip_use_the_whole_layer() {
        let obstacles = solid_image(2, CellValue::Obstacle);
        let layers = [LayerInput {
            id: "map",
            image: &obstacles,
            resolution: 1.0,
            origin: [0.0, 0.0, 0.0],
            blend_mode: "overwrite",
            z_index: 0,
            clip: None,
        }];
        let region = RectRegion {
            x: 0.0,
            y: 0.0,
            width: 2.0,
            height: 2.0,
        };

        let out = blend_layers_to_image(&layers, &region, 1.0);

        assert_eq!(cell_at(&out, 0, 0), CellValue::Obstacle);
        assert_eq!(cell_at(&out, 1, 1), CellValue::Obstacle);
    }

    /// The straightforward blend: every layer visits every output pixel and reads it through
    /// `DynamicImage::get_pixel`. `blend_layers_to_image` must produce exactly the same image.
    fn reference_blend(layers: &[LayerInput], region: &RectRegion, output_resolution: f64) -> RgbaImage {
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
            let (cos_yaw, sin_yaw) = if has_yaw { (yaw.cos(), yaw.sin()) } else { (1.0, 0.0) };
            for r in 0..out_h {
                for c in 0..out_w {
                    let world_x = region.x + (c as f64) * output_resolution;
                    let world_y = region.y + ((out_h - 1 - r) as f64) * output_resolution;
                    if let Some(clip) = layer.clip {
                        if !clip.contains(world_x, world_y) {
                            continue;
                        }
                    }
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
                    if px[3] < 128 {
                        continue;
                    }
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

    /// Deterministic pixels around the classification thresholds (gray 89/90, 229/230, alpha 127/128).
    fn noise_rgba(width: u32, height: u32, seed: u32) -> RgbaImage {
        const LEVELS: [u8; 10] = [0, 50, 89, 90, 128, 205, 229, 230, 254, 255];
        const ALPHAS: [u8; 4] = [255, 255, 128, 127];
        let mut state = seed.wrapping_mul(2_654_435_761).wrapping_add(1);
        let mut next = move || {
            state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            (state >> 16) as usize
        };
        RgbaImage::from_fn(width, height, |_, _| {
            let (r, g, b) = (LEVELS[next() % 10], LEVELS[next() % 10], LEVELS[next() % 10]);
            Rgba([r, g, b, ALPHAS[next() % 4]])
        })
    }

    /// The same noise in every pixel format the blend reads: the 8-bit fast paths and the generic fallback.
    fn noise_in_every_format(width: u32, height: u32, seed: u32) -> Vec<(&'static str, DynamicImage)> {
        let rgba = DynamicImage::ImageRgba8(noise_rgba(width, height, seed));
        vec![
            ("L8", DynamicImage::ImageLuma8(rgba.to_luma8())),
            ("LA8", DynamicImage::ImageLumaA8(rgba.to_luma_alpha8())),
            ("RGB8", DynamicImage::ImageRgb8(rgba.to_rgb8())),
            ("RGBA8", rgba.clone()),
            ("L16", DynamicImage::ImageLuma16(rgba.to_luma16())),
            ("RGBA32F", DynamicImage::ImageRgba32F(rgba.to_rgba32f())),
        ]
    }

    #[test]
    fn fast_pixel_paths_read_the_same_rgba_as_get_pixel() {
        for (format, image) in noise_in_every_format(31, 17, 7) {
            let source = PixelSource::new(&image);
            for (x, y, px) in image.pixels() {
                assert_eq!(source.rgba(x, y), px.0, "{format} at ({x}, {y})");
            }
        }
    }

    #[test]
    fn blend_matches_the_straightforward_blend_pixel_for_pixel() {
        use std::f64::consts::PI;

        let base = DynamicImage::ImageRgba8(noise_rgba(40, 40, 1));
        let clip = LayerClip {
            rects: vec![
                ClipRect {
                    x: -0.3,
                    y: -0.2,
                    width: 0.9,
                    height: 1.4,
                },
                ClipRect {
                    x: 0.6,
                    y: 0.5,
                    width: 1.1,
                    height: 0.3,
                },
            ],
        };
        // Regions around a layer of about 1.5 m × 1.0 m at the origin: containing it, cropping it,
        // straddling an edge, beside it, and sampled coarser / finer than the layer.
        let regions = [
            (
                RectRegion {
                    x: -2.0,
                    y: -2.0,
                    width: 4.0,
                    height: 4.0,
                },
                0.05,
            ),
            (
                RectRegion {
                    x: 0.2,
                    y: 0.1,
                    width: 0.5,
                    height: 0.4,
                },
                0.05,
            ),
            (
                RectRegion {
                    x: 1.0,
                    y: -0.7,
                    width: 1.5,
                    height: 1.2,
                },
                0.05,
            ),
            (
                RectRegion {
                    x: 5.0,
                    y: 5.0,
                    width: 1.0,
                    height: 1.0,
                },
                0.05,
            ),
            (
                RectRegion {
                    x: -1.0,
                    y: -1.0,
                    width: 3.0,
                    height: 2.5,
                },
                0.13,
            ),
            (
                RectRegion {
                    x: -0.5,
                    y: -0.5,
                    width: 1.0,
                    height: 1.0,
                },
                0.011,
            ),
        ];
        let modes = ["overwrite", "merge_obstacles", "merge_free", "replace", "unknown_mode"];
        let yaws = [0.0, PI / 2.0, 0.37, -2.1];
        // Layer resolutions, including degenerate ones that fall back to scanning everything.
        let resolutions = [0.05, 0.031, -0.05, 0.0];

        let mut compared = 0;
        for (format, image) in noise_in_every_format(50, 33, 3) {
            for &yaw in &yaws {
                for &resolution in &resolutions {
                    for layer_clip in [None, Some(&clip)] {
                        for mode in modes {
                            let layers = [
                                LayerInput {
                                    id: "base",
                                    image: &base,
                                    resolution: 0.05,
                                    origin: [-0.8, -0.6, 0.2],
                                    blend_mode: "overwrite",
                                    z_index: 0,
                                    clip: None,
                                },
                                LayerInput {
                                    id: "layer",
                                    image: &image,
                                    resolution,
                                    origin: [0.1, -0.15, yaw],
                                    blend_mode: mode,
                                    z_index: 1,
                                    clip: layer_clip,
                                },
                            ];
                            for (region, output_resolution) in &regions {
                                let expected = reference_blend(&layers, region, *output_resolution);
                                let actual = blend_layers_to_image(&layers, region, *output_resolution);
                                assert!(
                                    actual == expected,
                                    "{format} yaw={yaw} res={resolution} clip={} mode={mode} region=({}, {}) out_res={output_resolution}",
                                    layer_clip.is_some(),
                                    region.x,
                                    region.y,
                                );
                                compared += 1;
                            }
                        }
                    }
                }
            }
        }
        assert_eq!(compared, 6 * 4 * 4 * 2 * 5 * 6);
    }
}
