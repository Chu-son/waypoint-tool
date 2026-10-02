use crate::{io, map};
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::sync::Mutex;
use tauri::{command, AppHandle, Manager};

pub mod export_pipeline;

/// Serializes the file commands below. Synchronous commands run on the main thread, so they used to
/// run one at a time by construction; moved to blocking workers they would otherwise overlap (two
/// saves of the same file, a load during an export).
static IO_LOCK: Mutex<()> = Mutex::new(());

fn with_io_lock<T>(f: impl FnOnce() -> T) -> T {
    // A panic in an earlier command does not leave any shared state behind, so a poisoned lock is safe to reuse.
    let _guard = IO_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    f()
}

/// Runs heavy work on a blocking worker so the main thread (and with it the WebView) keeps responding.
async fn run_blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

/// Runs file work on a blocking worker, one command at a time (see [`IO_LOCK`]).
async fn run_blocking_io<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    run_blocking(move || with_io_lock(f)).await
}

// Read-only: not serialized, so the conflict list stays live while an export is writing.
#[command]
pub async fn check_export_conflicts(files: Vec<String>) -> Result<Vec<String>, String> {
    run_blocking(move || Ok(export_pipeline::check_export_conflicts(files))).await
}

#[command]
pub async fn execute_export_package(
    options: export_pipeline::ExportPackageOptions,
) -> Result<export_pipeline::ExportResultSummary, String> {
    run_blocking_io(move || export_pipeline::execute_export_package(options)).await
}

#[command]
pub async fn load_ros_map(yaml_path: String) -> Result<map::MapLoadResult, String> {
    run_blocking_io(move || map::load_map(&yaml_path)).await
}

#[command]
pub async fn export_maps(options: map::ExportMapsOptions) -> Result<(), String> {
    run_blocking_io(move || map::export_maps(options)).await
}

// Read-only: works on the images it is given, so it is not serialized with the file commands.
#[command]
pub async fn blend_map_preview(layers: Vec<map::BlendPreviewLayer>) -> Result<map::BlendPreviewResult, String> {
    run_blocking(move || map::blend_map_preview(layers)).await
}

#[command]
pub async fn save_project(path: String, data: serde_json::Value) -> Result<(), String> {
    run_blocking_io(move || io::save_project(&path, &data)).await
}

#[command]
pub async fn load_project(path: String) -> Result<serde_json::Value, String> {
    run_blocking_io(move || io::load_project(&path)).await
}

#[command]
pub fn load_options_schema(yaml_path: String) -> Result<serde_json::Value, String> {
    crate::models::options::load_options_schema(&yaml_path)
}

#[command]
pub async fn export_waypoints(
    path: String,
    waypoints: Vec<serde_json::Value>,
    template: Option<String>,
    image_data_b64: Option<String>,
) -> Result<(), String> {
    run_blocking_io(move || io::export_waypoints(&path, waypoints, template, image_data_b64)).await
}

#[command]
pub async fn import_waypoints(path: String) -> Result<serde_json::Value, String> {
    run_blocking_io(move || io::import_waypoints(&path)).await
}

#[command]
pub fn infer_import_mapping(
    template: String,
    engine: Option<crate::templating::TemplateEngine>,
) -> Result<serde_json::Value, String> {
    io::infer_import_mapping(&template, engine.unwrap_or_default())
}

#[command]
pub async fn read_image_base64(path: String) -> Result<String, String> {
    run_blocking_io(move || read_image_as_data_url(&path)).await
}

fn read_image_as_data_url(path: &str) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Failed to read image file: {}", e))?;

    // Determine mime type from extension
    let mime_type = match std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };

    let base64_str = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime_type, base64_str))
}

#[command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read text file: {}", e))
}

#[command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write text file: {}", e))
}

pub mod plugins;
pub use plugins::*;

pub mod custom_ui;
pub use custom_ui::*;

pub mod venv;
pub use venv::*;

/// 背景地図タイルを取得（キャッシュ優先）し、`data:` URL として返す。
#[command]
pub async fn fetch_map_tile(app: AppHandle, url: String) -> Result<String, String> {
    let cache_root = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = crate::tiles::fetch_cached(&cache_root, &url, crate::tiles::http_get)?;
        crate::tiles::to_data_url(&bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub fn force_exit(app: AppHandle) {
    app.exit(0);
}

#[command]
pub fn open_devtools(window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    window.open_devtools();
}

pub fn get_handlers() -> impl Fn(tauri::ipc::Invoke) -> bool {
    tauri::generate_handler![
        load_ros_map,
        export_maps,
        blend_map_preview,
        save_project,
        load_project,
        export_waypoints,
        import_waypoints,
        infer_import_mapping,
        load_options_schema,
        read_text_file,
        write_text_file,
        force_exit,
        fetch_map_tile,
        plugins::fetch_installed_plugins,
        plugins::run_plugin,
        plugins::scan_custom_plugin,
        plugins::scan_custom_plugins,
        plugins::get_python_environments,
        plugins::scaffold_plugin,
        plugins::check_sdk_version,
        plugins::update_plugin_sdk,
        read_image_base64,
        open_devtools,
        load_custom_ui_config,
        load_custom_ui_preset,
        venv::check_python_packages,
        venv::create_virtualenv,
        venv::install_pip_packages,
        check_export_conflicts,
        execute_export_package
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_read_image_base64_png() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.png");
        fs::write(&file_path, b"fake png data").unwrap();

        let res = read_image_as_data_url(&file_path.to_string_lossy());
        assert!(res.is_ok());
        let s = res.unwrap();
        assert!(s.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn test_read_image_base64_jpg() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.jpg");
        fs::write(&file_path, b"fake jpg data").unwrap();

        let res = read_image_as_data_url(&file_path.to_string_lossy());
        assert!(res.is_ok());
        let s = res.unwrap();
        assert!(s.starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn test_read_image_base64_unknown() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.unknown");
        fs::write(&file_path, b"data").unwrap();

        let res = read_image_as_data_url(&file_path.to_string_lossy());
        assert!(res.is_ok());
        let s = res.unwrap();
        assert!(s.starts_with("data:application/octet-stream;base64,"));
    }

    #[test]
    fn test_read_write_text_file() {
        let tmp = TempDir::new().unwrap();
        let file_path = tmp.path().join("test.txt");
        let path_str = file_path.to_string_lossy().to_string();

        let write_res = write_text_file(path_str.clone(), "Hello World".to_string());
        assert!(write_res.is_ok());

        let read_res = read_text_file(path_str);
        assert!(read_res.is_ok());
        assert_eq!(read_res.unwrap(), "Hello World");
    }

    #[test]
    fn file_commands_never_overlap() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Arc;

        let running = Arc::new(AtomicUsize::new(0));
        let max_seen = Arc::new(AtomicUsize::new(0));
        let workers: Vec<_> = (0..4)
            .map(|_| {
                let (running, max_seen) = (running.clone(), max_seen.clone());
                std::thread::spawn(move || {
                    with_io_lock(|| {
                        let now = running.fetch_add(1, Ordering::SeqCst) + 1;
                        max_seen.fetch_max(now, Ordering::SeqCst);
                        std::thread::sleep(std::time::Duration::from_millis(20));
                        running.fetch_sub(1, Ordering::SeqCst);
                    })
                })
            })
            .collect();
        for w in workers {
            w.join().unwrap();
        }

        assert_eq!(max_seen.load(Ordering::SeqCst), 1);
    }
}
