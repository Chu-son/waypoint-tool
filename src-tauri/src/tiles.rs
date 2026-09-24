//! 背景地図タイル（XYZ）の取得とディスクキャッシュ。
//!
//! フロントエンドが組み立てた URL を受け取り、取得結果を URL ごとにキャッシュする。
//! OSM のタイル利用ポリシーに従い、アプリを識別できる User-Agent を付けて取得する。

use base64::{engine::general_purpose, Engine as _};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

const MAX_TILE_BYTES: u64 = 5 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// http/https 以外（file:// など）は取得しない。
pub fn validate_url(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        Ok(())
    } else {
        Err(format!("Unsupported tile URL scheme: {}", url))
    }
}

/// FNV-1a 64bit。`DefaultHasher` は Rust のバージョンで値が変わりうるため、
/// 永続キャッシュのキーには使わない。
fn fnv1a64(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in input.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn cache_path(cache_root: &Path, url: &str) -> PathBuf {
    let key = format!("{:016x}", fnv1a64(url));
    cache_root.join("tiles").join(&key[..2]).join(key)
}

/// 画像として扱えるバイト列の MIME を先頭のマジックナンバーから判定する。
pub fn detect_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

pub fn to_data_url(bytes: &[u8]) -> Result<String, String> {
    let mime = detect_image_mime(bytes).ok_or_else(|| "Tile response is not an image".to_string())?;
    Ok(format!(
        "data:{};base64,{}",
        mime,
        general_purpose::STANDARD.encode(bytes)
    ))
}

/// キャッシュを優先して取得し、画像として有効なものだけをキャッシュへ書く。
pub fn fetch_cached<F>(cache_root: &Path, url: &str, fetch: F) -> Result<Vec<u8>, String>
where
    F: FnOnce(&str) -> Result<Vec<u8>, String>,
{
    validate_url(url)?;
    let path = cache_path(cache_root, url);

    if let Ok(bytes) = std::fs::read(&path) {
        if detect_image_mime(&bytes).is_some() {
            return Ok(bytes);
        }
    }

    let bytes = fetch(url)?;
    if detect_image_mime(&bytes).is_none() {
        return Err("Tile response is not an image".to_string());
    }
    if let Some(parent) = path.parent() {
        // キャッシュに書けなくても表示自体はできるので、失敗は無視する。
        let _ = std::fs::create_dir_all(parent);
        let _ = std::fs::write(&path, &bytes);
    }
    Ok(bytes)
}

pub fn http_get(url: &str) -> Result<Vec<u8>, String> {
    let agent = ureq::AgentBuilder::new().timeout(REQUEST_TIMEOUT).build();
    let response = agent
        .get(url)
        .set("User-Agent", concat!("waypoint-tool/", env!("CARGO_PKG_VERSION")))
        .call()
        .map_err(|e| format!("Failed to fetch tile: {}", e))?;

    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(MAX_TILE_BYTES)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read tile: {}", e))?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use tempfile::TempDir;

    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];

    #[test]
    fn only_http_and_https_urls_are_allowed() {
        assert!(validate_url("https://tile.openstreetmap.org/1/2/3.png").is_ok());
        assert!(validate_url("HTTP://example.com/1/2/3.png").is_ok());
        assert!(validate_url("file:///etc/passwd").is_err());
        assert!(validate_url("ftp://example.com/a.png").is_err());
    }

    #[test]
    fn cache_path_is_stable_and_distinct_per_url() {
        let root = Path::new("/cache");
        let a = cache_path(root, "https://t.example/1/2/3.png");
        assert_eq!(a, cache_path(root, "https://t.example/1/2/3.png"));
        assert_ne!(a, cache_path(root, "https://t.example/1/2/4.png"));
        assert!(a.starts_with("/cache/tiles"));
        // ハッシュ値そのものが永続キャッシュの互換性になるので固定しておく
        assert_eq!(fnv1a64(""), 0xcbf29ce484222325);
        assert_eq!(fnv1a64("a"), 0xaf63dc4c8601ec8c);
    }

    #[test]
    fn detects_image_types_by_magic_number() {
        assert_eq!(detect_image_mime(PNG), Some("image/png"));
        assert_eq!(detect_image_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(detect_image_mime(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(detect_image_mime(b"<html>error</html>"), None);
    }

    #[test]
    fn second_request_is_served_from_disk_without_fetching() {
        let tmp = TempDir::new().unwrap();
        let calls = Cell::new(0);
        let fetch = |_: &str| {
            calls.set(calls.get() + 1);
            Ok(PNG.to_vec())
        };

        let url = "https://t.example/1/2/3.png";
        assert_eq!(fetch_cached(tmp.path(), url, fetch).unwrap(), PNG);
        assert_eq!(fetch_cached(tmp.path(), url, fetch).unwrap(), PNG);
        assert_eq!(calls.get(), 1);
    }

    #[test]
    fn non_image_responses_are_rejected_and_not_cached() {
        let tmp = TempDir::new().unwrap();
        let url = "https://t.example/1/2/3.png";

        let err = fetch_cached(tmp.path(), url, |_| Ok(b"<html>rate limited</html>".to_vec()));
        assert!(err.is_err());
        assert!(!cache_path(tmp.path(), url).exists());

        // 壊れた応答が残らないので、次の取得は改めてネットワークへ行ける
        assert_eq!(fetch_cached(tmp.path(), url, |_| Ok(PNG.to_vec())).unwrap(), PNG);
    }

    #[test]
    fn rejects_unsupported_schemes_before_fetching() {
        let tmp = TempDir::new().unwrap();
        let result = fetch_cached(tmp.path(), "file:///etc/passwd", |_| panic!("must not fetch"));
        assert!(result.is_err());
    }

    #[test]
    fn data_url_carries_the_detected_mime() {
        let url = to_data_url(PNG).unwrap();
        assert!(url.starts_with("data:image/png;base64,"));
        assert!(to_data_url(b"nope").is_err());
    }
}
