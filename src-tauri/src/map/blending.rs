use super::layer_decode::ClassifiedLayer;
use image::{Rgba, RgbaImage};
use rayon::prelude::*;
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
    pub image: &'a ClassifiedLayer,
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

/// ブレンド結果。1 セル 1 値で持ち、RGBA 画像・PGM 用のグレー値・プレビュー用のバイト列はここから作る。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlendedCells {
    pub width: u32,
    pub height: u32,
    /// 行優先、上の行から。
    pub cells: Vec<CellValue>,
}

impl BlendedCells {
    pub fn to_rgba_image(&self) -> RgbaImage {
        let mut raw = vec![0u8; self.cells.len() * 4];
        raw.par_chunks_exact_mut(4)
            .zip(self.cells.par_iter())
            .for_each(|(px, cell)| px.copy_from_slice(&cell.to_rgba().0));
        RgbaImage::from_raw(self.width, self.height, raw).expect("buffer holds width × height RGBA pixels")
    }

    /// `to_rgba_image()` を `DynamicImage::into_luma8()` で変換したものと同じバイト列（ROS 標準の PGM 用）。
    pub fn to_luma8(&self) -> Vec<u8> {
        // 取り得る色は 3 つだけなので、画像ライブラリの変換を 3 回通して表にする。
        let palette = RgbaImage::from_fn(3, 1, |x, _| CELL_ORDER[x as usize].to_rgba());
        let luma = image::DynamicImage::ImageRgba8(palette).into_luma8().into_raw();
        self.cells.par_iter().map(|cell| luma[*cell as usize]).collect()
    }
}

/// `CellValue as usize` の並び（宣言順）。
const CELL_ORDER: [CellValue; 3] = [CellValue::Unknown, CellValue::Free, CellValue::Obstacle];

/// これより小さい出力は、帯に分けても並列化のコストのほうが大きいので 1 本で処理する。
const MIN_PARALLEL_CELLS: u64 = 65_536;
/// 帯の数は並列度の何倍にするか（帯ごとの負荷の偏りをならす）。
const BANDS_PER_THREAD: usize = 4;

/// レイヤー群を指定されたワールド矩形領域に共通アルゴリズムで合成描画
pub fn blend_layers_to_image(layers: &[LayerInput], region: &RectRegion, output_resolution: f64) -> RgbaImage {
    blend_layers_to_cells(layers, region, output_resolution).to_rgba_image()
}

/// `blend_layers_to_image` と同じ合成を、画像にする前のセル値で返す。
pub fn blend_layers_to_cells(layers: &[LayerInput], region: &RectRegion, output_resolution: f64) -> BlendedCells {
    blend_layers_to_cells_cancellable(layers, region, output_resolution, &|| false)
        .expect("a blend that is never cancelled always completes")
}

/// `is_cancelled` が true を返したら、残りの計算を省いて `None` を返す。
/// 結果が捨てられると分かっている呼び出し（新しい要求に置き換えられたプレビュー）が CPU を使い続けないための仕組み。
pub fn blend_layers_to_cells_cancellable(
    layers: &[LayerInput],
    region: &RectRegion,
    output_resolution: f64,
    is_cancelled: &(dyn Fn() -> bool + Sync),
) -> Option<BlendedCells> {
    let (out_w, out_h) = output_size(region, output_resolution);
    blend_cells(
        layers,
        region,
        output_resolution,
        default_band_rows(out_w, out_h),
        is_cancelled,
    )
}

fn output_size(region: &RectRegion, output_resolution: f64) -> (u32, u32) {
    (
        (region.width / output_resolution).round() as u32,
        (region.height / output_resolution).round() as u32,
    )
}

/// 並列に処理する行の帯の高さ。小さい出力は全体を 1 つの帯にする。
fn default_band_rows(out_w: u32, out_h: u32) -> u32 {
    if (out_w as u64) * (out_h as u64) < MIN_PARALLEL_CELLS {
        return out_h.max(1);
    }
    let bands = rayon::current_num_threads() * BANDS_PER_THREAD;
    (out_h as usize).div_ceil(bands).max(1) as u32
}

/// 出力の行を `band_rows` 行ずつの帯に分け、帯ごとに全レイヤーを z 順に適用する。
/// セルどうしは独立なので、帯の分け方によらず結果は同じ。
fn blend_cells(
    layers: &[LayerInput],
    region: &RectRegion,
    output_resolution: f64,
    band_rows: u32,
    is_cancelled: &(dyn Fn() -> bool + Sync),
) -> Option<BlendedCells> {
    let (out_w, out_h) = output_size(region, output_resolution);

    if out_w == 0 || out_h == 0 {
        return Some(BlendedCells {
            width: 0,
            height: 0,
            cells: Vec::new(),
        });
    }

    let mut sorted_layers: Vec<_> = layers.iter().collect();
    sorted_layers.sort_by_key(|l| l.z_index);
    let plans: Vec<LayerPlan> = sorted_layers
        .into_iter()
        .filter_map(|layer| LayerPlan::new(layer, region, output_resolution, out_w, out_h))
        .collect();

    let mut cells = vec![CellValue::Unknown; out_w as usize * out_h as usize];
    let band_cells = band_rows.max(1) as usize * out_w as usize;
    cells.par_chunks_mut(band_cells).enumerate().for_each(|(band, chunk)| {
        let first_row = band as u32 * band_rows.max(1);
        for plan in &plans {
            if is_cancelled() {
                return;
            }
            plan.apply(chunk, first_row, out_w);
        }
    });

    if is_cancelled() {
        return None;
    }
    Some(BlendedCells {
        width: out_w,
        height: out_h,
        cells,
    })
}

/// レイヤー画像上に該当する画素が無いことを表す番兵。
const OUT_OF_LAYER: u32 = u32::MAX;
/// 矩形のビットマスクで判定できる上限（これを超えたら矩形を順に調べる）。
const MAX_MASKED_RECTS: usize = 64;

/// 1 レイヤーぶんの、出力の列・行ごとに前計算した値。
/// 出力画素 (c, r) のワールド座標 → レイヤー座標の変換は、x と y を別々に計算して足すだけの形をしているので、
/// 画素ごとに f64 の変換をやり直さず、列ごと・行ごとに 1 回だけ計算する。式と演算順序は 1 画素ずつ計算する
/// 場合（`reference_blend`）と同じなので、結果はビット単位で同じ。
struct LayerPlan<'a> {
    image: &'a ClassifiedLayer,
    blend_mode: BlendMode,
    /// 走査する列・行の範囲（`layer_output_range`、両端を含む）。
    c0: u32,
    c1: u32,
    r0: u32,
    r1: u32,
    mapping: Mapping,
    clip: ClipPlan<'a>,
}

enum Mapping {
    /// yaw なし。レイヤーの列は出力の列だけ、行は出力の行だけで決まる。
    Axis { cols: Vec<u32>, rows: Vec<u32> },
    /// yaw あり。`lx = col.0 + row.0`、`ly = col.1 + row.1`。
    Rotated {
        cols: Vec<(f64, f64)>,
        rows: Vec<(f64, f64)>,
        resolution: f64,
        layer_height: f64,
    },
}

enum ClipPlan<'a> {
    None,
    /// 矩形ごとに 1 ビット。矩形はワールド座標の x と y の条件の AND なので、列のマスクと行のマスクの AND が 0 でなければ内側。
    Masks {
        cols: Vec<u64>,
        rows: Vec<u64>,
    },
    /// 矩形が多いとき。1 画素ずつ `LayerClip::contains` で調べる。
    Rects {
        clip: &'a LayerClip,
        xs: Vec<f64>,
        ys: Vec<f64>,
    },
}

impl<'a> LayerPlan<'a> {
    /// 出力のどの画素にも当たらないレイヤーは `None`。
    fn new(
        layer: &'a LayerInput<'a>,
        region: &RectRegion,
        output_resolution: f64,
        out_w: u32,
        out_h: u32,
    ) -> Option<Self> {
        let image = layer.image;
        let l_w = image.width() as f64;
        let l_h = image.height() as f64;
        let yaw = layer.origin[2];
        let has_yaw = yaw.abs() >= 1e-9;
        let (cos_yaw, sin_yaw) = if has_yaw { (yaw.cos(), yaw.sin()) } else { (1.0, 0.0) };

        let (c0, c1, r0, r1) = layer_output_range(
            layer,
            region,
            output_resolution,
            out_w,
            out_h,
            (cos_yaw, sin_yaw),
            has_yaw,
        )?;

        let xs: Vec<f64> = (c0..=c1).map(|c| region.x + (c as f64) * output_resolution).collect();
        let ys: Vec<f64> = (r0..=r1)
            .map(|r| region.y + ((out_h - 1 - r) as f64) * output_resolution)
            .collect();

        let mapping = if has_yaw {
            Mapping::Rotated {
                cols: xs
                    .iter()
                    .map(|&world_x| {
                        let dx = world_x - layer.origin[0];
                        (dx * cos_yaw, -dx * sin_yaw)
                    })
                    .collect(),
                rows: ys
                    .iter()
                    .map(|&world_y| {
                        let dy = world_y - layer.origin[1];
                        (dy * sin_yaw, dy * cos_yaw)
                    })
                    .collect(),
                resolution: layer.resolution,
                layer_height: l_h,
            }
        } else {
            Mapping::Axis {
                cols: xs
                    .iter()
                    .map(|&world_x| {
                        let c_l = ((world_x - layer.origin[0]) / layer.resolution).round() as i32;
                        if c_l < 0 || c_l >= l_w as i32 {
                            OUT_OF_LAYER
                        } else {
                            c_l as u32
                        }
                    })
                    .collect(),
                rows: ys
                    .iter()
                    .map(|&world_y| {
                        let r_l = (l_h - 1.0 - (world_y - layer.origin[1]) / layer.resolution).round() as i32;
                        if r_l < 0 || r_l >= l_h as i32 {
                            OUT_OF_LAYER
                        } else {
                            r_l as u32
                        }
                    })
                    .collect(),
            }
        };

        let clip = match layer.clip {
            None => ClipPlan::None,
            Some(clip) if clip.rects.len() <= MAX_MASKED_RECTS => {
                let mask = |value: f64, along_x: bool| {
                    clip.rects.iter().enumerate().fold(0u64, |bits, (i, r)| {
                        let (start, size) = if along_x { (r.x, r.width) } else { (r.y, r.height) };
                        if value >= start && value < start + size {
                            bits | (1 << i)
                        } else {
                            bits
                        }
                    })
                };
                ClipPlan::Masks {
                    cols: xs.iter().map(|&x| mask(x, true)).collect(),
                    rows: ys.iter().map(|&y| mask(y, false)).collect(),
                }
            }
            Some(clip) => ClipPlan::Rects { clip, xs, ys },
        };

        Some(Self {
            image,
            blend_mode: BlendMode::parse(layer.blend_mode),
            c0,
            c1,
            r0,
            r1,
            mapping,
            clip,
        })
    }

    #[inline]
    fn inside_clip(&self, col: usize, row: usize) -> bool {
        match &self.clip {
            ClipPlan::None => true,
            ClipPlan::Masks { cols, rows } => cols[col] & rows[row] != 0,
            ClipPlan::Rects { clip, xs, ys } => clip.contains(xs[col], ys[row]),
        }
    }

    /// 出力の `first_row` 行目から始まる帯 `chunk`（`out_w` 列幅）に、このレイヤーを合成する。
    fn apply(&self, chunk: &mut [CellValue], first_row: u32, out_w: u32) {
        let band_rows = (chunk.len() / out_w as usize) as u32;
        let first = first_row.max(self.r0);
        let last = (first_row + band_rows - 1).min(self.r1);
        if first > last {
            return;
        }

        for r in first..=last {
            let ri = (r - self.r0) as usize;
            if matches!(&self.mapping, Mapping::Axis { rows, .. } if rows[ri] == OUT_OF_LAYER) {
                continue;
            }
            let row_cells = &mut chunk[((r - first_row) * out_w) as usize..][..out_w as usize];
            for c in self.c0..=self.c1 {
                let ci = (c - self.c0) as usize;
                if !self.inside_clip(ci, ri) {
                    continue;
                }

                let (c_l, r_l) = match &self.mapping {
                    Mapping::Axis { cols, rows } => (cols[ci], rows[ri]),
                    Mapping::Rotated {
                        cols,
                        rows,
                        resolution,
                        layer_height,
                    } => {
                        let lx = cols[ci].0 + rows[ri].0;
                        let ly = cols[ci].1 + rows[ri].1;
                        let c_l = (lx / resolution).round() as i32;
                        let r_l = (layer_height - 1.0 - ly / resolution).round() as i32;
                        if c_l < 0 || c_l >= self.image.width() as i32 || r_l < 0 || r_l >= self.image.height() as i32 {
                            continue;
                        }
                        (c_l as u32, r_l as u32)
                    }
                };
                if c_l == OUT_OF_LAYER || r_l == OUT_OF_LAYER {
                    continue;
                }

                // Transparent pixels carry no data (custom layers are rasterized on a transparent
                // background), so they never take part in blending, whatever the blend mode.
                let Some(incoming) = self.image.cell(c_l, r_l) else {
                    continue;
                };
                let slot = &mut row_cells[c as usize];
                *slot = self.blend_mode.apply(*slot, incoming);
            }
        }
    }
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
    use crate::map::layer_decode::test_support::{noise_in_every_format, noise_rgba};
    use image::{DynamicImage, GenericImageView};

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

        let dyn_img = ClassifiedLayer::from_image(&DynamicImage::ImageRgba8(img));

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

    fn solid_image(size: u32, cell: CellValue) -> ClassifiedLayer {
        ClassifiedLayer::from_image(&DynamicImage::ImageRgba8(RgbaImage::from_pixel(
            size,
            size,
            cell.to_rgba(),
        )))
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
        image: &'a ClassifiedLayer,
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
        let transparent = ClassifiedLayer::from_image(&DynamicImage::ImageRgba8(RgbaImage::from_pixel(
            2,
            2,
            Rgba([0, 0, 0, 0]),
        )));
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

    /// A layer for the equivalence test: the original picture (read by the reference through
    /// `DynamicImage::get_pixel`) and the same picture classified for the engine under test.
    struct TestLayer {
        image: DynamicImage,
        classified: ClassifiedLayer,
        resolution: f64,
        origin: [f64; 3],
        blend_mode: &'static str,
        z_index: i32,
        clip: Option<LayerClip>,
    }

    impl TestLayer {
        fn new(
            image: DynamicImage,
            resolution: f64,
            origin: [f64; 3],
            blend_mode: &'static str,
            z_index: i32,
            clip: Option<LayerClip>,
        ) -> Self {
            let classified = ClassifiedLayer::from_image(&image);
            Self {
                image,
                classified,
                resolution,
                origin,
                blend_mode,
                z_index,
                clip,
            }
        }

        fn input(&self) -> LayerInput<'_> {
            LayerInput {
                id: "layer",
                image: &self.classified,
                resolution: self.resolution,
                origin: self.origin,
                blend_mode: self.blend_mode,
                z_index: self.z_index,
                clip: self.clip.as_ref(),
            }
        }
    }

    /// The straightforward blend: every layer visits every output pixel and reads it through
    /// `DynamicImage::get_pixel`. `blend_layers_to_image` must produce exactly the same image.
    fn reference_blend(layers: &[TestLayer], region: &RectRegion, output_resolution: f64) -> RgbaImage {
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
                    if let Some(clip) = layer.clip.as_ref() {
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

    /// Clips of many small rectangles in a scatter: past `MAX_MASKED_RECTS`, so they take the slow path.
    fn many_rect_clip(count: usize) -> LayerClip {
        LayerClip {
            rects: (0..count)
                .map(|i| ClipRect {
                    x: -0.6 + (i % 10) as f64 * 0.17,
                    y: -0.5 + (i / 10) as f64 * 0.13,
                    width: 0.15,
                    height: 0.11,
                })
                .collect(),
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

        // No clip, a clip of two rectangles (bit masks), and one past the mask limit (rectangle by rectangle).
        let clips = [None, Some(clip), Some(many_rect_clip(MAX_MASKED_RECTS + 6))];
        // Thread count × band height: one band on one thread, one-row bands on a few threads,
        // and uneven bands on more threads than there are bands.
        let pools: Vec<_> = [(1, None), (2, Some(1)), (7, Some(3))]
            .into_iter()
            .map(|(n, band_rows)| {
                (
                    rayon::ThreadPoolBuilder::new().num_threads(n).build().unwrap(),
                    band_rows,
                )
            })
            .collect();

        let mut compared = 0;
        for (format, image) in noise_in_every_format(50, 33, 3) {
            for &yaw in &yaws {
                for &resolution in &resolutions {
                    for layer_clip in &clips {
                        for mode in modes {
                            // The clip does not depend on the blend mode, and the many-rectangle clip is slow to check.
                            let many_rects = layer_clip.as_ref().is_some_and(|c| c.rects.len() > MAX_MASKED_RECTS);
                            if many_rects && mode != "overwrite" {
                                continue;
                            }
                            let layers = [
                                TestLayer::new(base.clone(), 0.05, [-0.8, -0.6, 0.2], "overwrite", 0, None),
                                TestLayer::new(
                                    image.clone(),
                                    resolution,
                                    [0.1, -0.15, yaw],
                                    mode,
                                    1,
                                    layer_clip.clone(),
                                ),
                            ];
                            let inputs: Vec<_> = layers.iter().map(TestLayer::input).collect();
                            for (region, output_resolution) in &regions {
                                let case = format!(
                                    "{format} yaw={yaw} res={resolution} clip={:?} mode={mode} region=({}, {}) out_res={output_resolution}",
                                    layer_clip.as_ref().map(|c| c.rects.len()),
                                    region.x,
                                    region.y,
                                );
                                let expected = reference_blend(&layers, region, *output_resolution);
                                let actual = blend_layers_to_image(&inputs, region, *output_resolution);
                                assert!(actual == expected, "{case}");

                                // Splitting the output into bands, on any number of threads, changes nothing.
                                // How the layer samples is independent of the banding, so one resolution is enough.
                                let (_, out_h) = output_size(region, *output_resolution);
                                let pools = if resolution == 0.05 { &pools[..] } else { &[] };
                                for (pool, band_rows) in pools {
                                    let band_rows = band_rows.unwrap_or(out_h.max(1));
                                    let banded = pool
                                        .install(|| {
                                            blend_cells(&inputs, region, *output_resolution, band_rows, &|| false)
                                        })
                                        .expect("not cancelled")
                                        .to_rgba_image();
                                    assert!(
                                        banded == expected,
                                        "{case}: bands of {band_rows} rows on {} threads",
                                        pool.current_num_threads()
                                    );
                                }
                                compared += 1;
                            }
                        }
                    }
                }
            }
        }
        // formats × yaws × resolutions × (modes × 2 clips + 1 many-rectangle clip) × regions
        assert_eq!(compared, 6 * 4 * 4 * (5 * 2 + 1) * 6);
    }

    #[test]
    fn a_cancelled_blend_returns_nothing() {
        let obstacles = solid_image(4, CellValue::Obstacle);
        let layers = [layer_with("map", &obstacles, "overwrite", 0, None)];

        let blended = blend_layers_to_cells_cancellable(&layers, &region_of(4.0), 1.0, &|| true);

        assert!(blended.is_none());
    }

    #[test]
    fn a_blend_cancelled_midway_stops_before_applying_the_remaining_layers() {
        use std::sync::atomic::{AtomicUsize, Ordering};

        let obstacles = solid_image(4, CellValue::Obstacle);
        let layers = [
            layer_with("a", &obstacles, "overwrite", 0, None),
            layer_with("b", &obstacles, "overwrite", 1, None),
            layer_with("c", &obstacles, "overwrite", 2, None),
        ];
        // The request is superseded after the first check.
        let checks = AtomicUsize::new(0);
        let is_cancelled = || checks.fetch_add(1, Ordering::SeqCst) >= 1;

        let blended = blend_cells(&layers, &region_of(4.0), 1.0, 4, &is_cancelled);

        assert!(blended.is_none());
        assert!(
            checks.load(Ordering::SeqCst) < 4,
            "the layers after the cancellation were not even visited"
        );
    }

    #[test]
    fn luma_bytes_equal_the_rgba_image_converted_by_the_image_crate() {
        let cells = BlendedCells {
            width: 3,
            height: 2,
            cells: vec![
                CellValue::Unknown,
                CellValue::Free,
                CellValue::Obstacle,
                CellValue::Obstacle,
                CellValue::Free,
                CellValue::Unknown,
            ],
        };

        let expected = DynamicImage::ImageRgba8(cells.to_rgba_image()).into_luma8().into_raw();

        assert_eq!(cells.to_luma8(), expected);
    }
}
