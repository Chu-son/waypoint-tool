use serde_yaml;
use std::fs;
use std::path::Path;
use image::GenericImageView;
use base64::{Engine as _, engine::general_purpose};
use crate::models::MapInfo;

#[derive(Debug, serde::Serialize)]
pub struct MapLoadResult {
    pub info: MapInfo,
    // Base64 encoded PNG or WebP data string to use in <img> or Canvas
    pub image_data_b64: String, 
    pub width: u32,
    pub height: u32,
}

pub fn load_map(yaml_path: &str) -> std::result::Result<MapLoadResult, String> {
    let path = Path::new(yaml_path);
    let parent_dir = path.parent().unwrap_or(Path::new(""));

    // 1. Parse YAML
    let yaml_content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read YAML: {}", e))?;
    
    let map_info: MapInfo = serde_yaml::from_str(&yaml_content)
        .map_err(|e| format!("Failed to parse YAML: {}", e))?;

    // 2. Load image (PGM or PNG)
    let image_path = parent_dir.join(&map_info.image);
    let img = image::open(&image_path)
        .map_err(|e| format!("Failed to open image {}: {}", image_path.display(), e))?;

    let (width, height) = img.dimensions();

    // 3. Convert image to PNG and encode to Base64 so frontend can render it easily
    let mut png_data: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_data);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image to PNG: {}", e))?;

    let b64 = general_purpose::STANDARD.encode(&png_data);
    let image_data_b64 = format!("data:image/png;base64,{}", b64);

    Ok(MapLoadResult {
        info: map_info,
        image_data_b64,
        width,
        height
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs::File;
    use std::io::Write;
    use image::{ImageBuffer, Rgb};

    #[test]
    fn test_load_valid_ros_map() {
        let dir = tempdir().unwrap();
        
        // 1. Create a dummy image (PNG is fine, image crate handles it)
        let img_path = dir.path().join("dummy_map.png");
        let img = ImageBuffer::from_pixel(10, 10, Rgb([255u8, 255u8, 255u8]));
        img.save(&img_path).unwrap();

        // 2. Create the YAML file
        let yaml_path = dir.path().join("map.yaml");
        let yaml_content = format!(
            "image: dummy_map.png\nresolution: 0.05\norigin: [-10.0, -10.0, 0.0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196"
        );
        let mut file = File::create(&yaml_path).unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();

        // 3. Test load_map
        let result = load_map(yaml_path.to_str().unwrap());
        assert!(result.is_ok());

        let loaded = result.unwrap();
        assert_eq!(loaded.info.resolution, 0.05);
        assert_eq!(loaded.info.origin, [-10.0, -10.0, 0.0]);
        assert_eq!(loaded.width, 10);
        assert_eq!(loaded.height, 10);
        assert!(loaded.image_data_b64.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn test_load_map_missing_image() {
        let dir = tempdir().unwrap();
        let yaml_path = dir.path().join("map.yaml");
        let yaml_content = format!(
            "image: does_not_exist.png\nresolution: 0.05\norigin: [0, 0, 0]\nnegate: 0\noccupied_thresh: 0.65\nfree_thresh: 0.196"
        );
        let mut file = File::create(&yaml_path).unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();

        let result = load_map(yaml_path.to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open image"));
    }
}
