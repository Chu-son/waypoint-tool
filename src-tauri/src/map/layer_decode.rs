use super::blending::{classify_pixel, CellValue};
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, GenericImageView, RgbaImage};
use rayon::prelude::*;
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex, MutexGuard};

const NO_DATA: u8 = 0;
const UNKNOWN: u8 = 1;
const FREE: u8 = 2;
const OBSTACLE: u8 = 3;

/// レイヤー画像の画素を、ブレンドが使う 3 値（Unknown / Free / Obstacle）か「データなし」に一度だけ分類したもの。
/// 1 画素 1 バイトなので RGBA のまま持つより小さく、ブレンドは分類済みの値を引くだけで済む。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassifiedLayer {
    width: u32,
    height: u32,
    cells: Vec<u8>,
}

impl ClassifiedLayer {
    pub fn from_image(image: &DynamicImage) -> Self {
        let (width, height) = image.dimensions();
        let mut cells = vec![NO_DATA; width as usize * height as usize];
        if width > 0 {
            let source = PixelSource::new(image);
            cells
                .par_chunks_mut(width as usize)
                .enumerate()
                .for_each(|(y, row)| source.classify_row(y as u32, row));
        }
        Self { width, height, cells }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// 透明な画素（データなし）は `None`。範囲外の座標を渡してはならない。
    #[inline]
    pub fn cell(&self, x: u32, y: u32) -> Option<CellValue> {
        match self.cells[y as usize * self.width as usize + x as usize] {
            UNKNOWN => Some(CellValue::Unknown),
            FREE => Some(CellValue::Free),
            OBSTACLE => Some(CellValue::Obstacle),
            _ => None,
        }
    }
}

/// `classify_pixel` の結果を保存用のコードにする。透明（α < 128）な画素はどのブレンドモードでも合成に参加しない。
fn classify_to_code(rgba: [u8; 4]) -> u8 {
    if rgba[3] < 128 {
        return NO_DATA;
    }
    match classify_pixel(rgba) {
        CellValue::Unknown => UNKNOWN,
        CellValue::Free => FREE,
        CellValue::Obstacle => OBSTACLE,
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

    /// 1 行ぶんを分類する。グレースケールは取り得る値が 256 通りなので、表を引く。
    fn classify_row(&self, y: u32, row: &mut [u8]) {
        match self {
            PixelSource::L8(img) => {
                let lut = gray_lut();
                for (x, out) in row.iter_mut().enumerate() {
                    *out = lut[img.get_pixel(x as u32, y).0[0] as usize];
                }
            }
            _ => {
                for (x, out) in row.iter_mut().enumerate() {
                    *out = classify_to_code(self.rgba(x as u32, y));
                }
            }
        }
    }
}

/// 不透明なグレー値 → 分類コード。
fn gray_lut() -> [u8; 256] {
    std::array::from_fn(|v| classify_to_code([v as u8, v as u8, v as u8, 255]))
}

#[derive(Debug)]
pub enum LayerDecodeError {
    Base64(String),
    Image(String),
}

impl fmt::Display for LayerDecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LayerDecodeError::Base64(e) => write!(f, "Base64 decode error: {}", e),
            LayerDecodeError::Image(e) => write!(f, "Image load error: {}", e),
        }
    }
}

/// レイヤー画像（base64、`data:image...,` 付きも可）をデコードして分類する。
pub fn decode_layer(b64: &str) -> Result<ClassifiedLayer, LayerDecodeError> {
    let b64_data = if b64.starts_with("data:image") {
        b64.split(',').nth(1).unwrap_or(b64)
    } else {
        b64
    };
    let bytes = general_purpose::STANDARD
        .decode(b64_data)
        .map_err(|e| LayerDecodeError::Base64(e.to_string()))?;
    let image = image::load_from_memory(&bytes).map_err(|e| LayerDecodeError::Image(e.to_string()))?;
    Ok(ClassifiedLayer::from_image(&image))
}

/// デコード済みレイヤーを引くためのキー: base64 文字列の内容のハッシュと長さ。
/// 画像の内容で引くので、地図の編集・プラグインの再生成・プロジェクトの切り替えで画像が変われば別のキーになり、
/// 古い値を返すことはない（無効化の管理は要らない）。
pub type LayerKey = (u64, usize);

pub fn layer_key(b64: &str) -> LayerKey {
    // `DefaultHasher::new()` はキーが固定なので、同じ文字列は同じハッシュになる。
    let mut hasher = DefaultHasher::new();
    b64.hash(&mut hasher);
    (hasher.finish(), b64.len())
}

/// デコード・分類済みのレイヤーをメモリに残して、プレビューの再生成でデコードをやり直さないようにする。
/// メモリを使うので、設定で切れる。寿命は呼び出し側が決める（[`DecodeCache::retain_only`] / [`DecodeCache::clear`]）。
#[derive(Clone, Default)]
pub struct DecodeCache {
    entries: Arc<Mutex<HashMap<LayerKey, Arc<ClassifiedLayer>>>>,
}

impl DecodeCache {
    /// キャッシュにあればそれを返し、なければデコードして入れる。ロックはデコードの間は持たない。
    pub fn decode(&self, b64: &str) -> Result<(LayerKey, Arc<ClassifiedLayer>), LayerDecodeError> {
        let key = layer_key(b64);
        if let Some(hit) = self.lock().get(&key) {
            return Ok((key, Arc::clone(hit)));
        }
        let decoded = Arc::new(decode_layer(b64)?);
        self.lock().insert(key, Arc::clone(&decoded));
        Ok((key, decoded))
    }

    /// `keys` にあるものだけを残す。今のレイヤー構成で使われなくなった画像のぶんのメモリを手放す。
    pub fn retain_only(&self, keys: &HashSet<LayerKey>) {
        self.lock().retain(|key, _| keys.contains(key));
    }

    pub fn clear(&self) {
        self.lock().clear();
    }

    pub fn len(&self) -> usize {
        self.lock().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<LayerKey, Arc<ClassifiedLayer>>> {
        // キャッシュの中身はいつでも作り直せるので、他のスレッドが panic して poisoned になっていても使い続けてよい。
        self.entries.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// 分類のテストとブレンドのテストが共有する、しきい値まわりの画素を並べた画像。
#[cfg(test)]
pub(crate) mod test_support {
    use image::{DynamicImage, Rgba, RgbaImage};

    /// Deterministic pixels around the classification thresholds (gray 89/90, 229/230, alpha 127/128).
    pub(crate) fn noise_rgba(width: u32, height: u32, seed: u32) -> RgbaImage {
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

    /// The same noise in every pixel format the classification reads: the 8-bit fast paths and the generic fallback.
    pub(crate) fn noise_in_every_format(width: u32, height: u32, seed: u32) -> Vec<(&'static str, DynamicImage)> {
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
}

#[cfg(test)]
mod tests {
    use super::test_support::noise_in_every_format;
    use super::*;

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
    fn every_pixel_is_classified_as_the_blend_would_have_read_it() {
        for (format, image) in noise_in_every_format(31, 17, 7) {
            let layer = ClassifiedLayer::from_image(&image);
            assert_eq!((layer.width(), layer.height()), (31, 17), "{format}");
            for (x, y, px) in image.pixels() {
                let expected = (px.0[3] >= 128).then(|| classify_pixel(px.0));
                assert_eq!(layer.cell(x, y), expected, "{format} at ({x}, {y})");
            }
        }
    }

    #[test]
    fn an_empty_image_has_no_cells() {
        let layer = ClassifiedLayer::from_image(&DynamicImage::ImageLuma8(image::GrayImage::new(0, 5)));
        assert_eq!((layer.width(), layer.height()), (0, 5));
    }

    fn png_b64(image: &DynamicImage) -> String {
        let mut png = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();
        general_purpose::STANDARD.encode(&png)
    }

    #[test]
    fn decodes_plain_and_data_url_base64_alike() {
        let image = DynamicImage::ImageLuma8(image::GrayImage::from_fn(4, 3, |x, y| {
            image::Luma([(x * 60 + y) as u8])
        }));
        let plain = png_b64(&image);

        let from_plain = decode_layer(&plain).unwrap();
        let from_data_url = decode_layer(&format!("data:image/png;base64,{}", plain)).unwrap();

        assert_eq!(from_plain, from_data_url);
        assert_eq!(from_plain, ClassifiedLayer::from_image(&image));
    }

    #[test]
    fn reports_which_step_failed() {
        assert!(matches!(
            decode_layer("!!not base64!!"),
            Err(LayerDecodeError::Base64(_))
        ));
        assert!(matches!(decode_layer("AAAA"), Err(LayerDecodeError::Image(_))));
    }
}
