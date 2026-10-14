use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use tauri::{command, AppHandle, Manager};

const SETTINGS_FILE: &str = "settings.json";

/// Serializes settings reads and writes. Deliberately not `IO_LOCK`: an export can hold that for a long
/// time, and saving the settings (or quitting) must not wait for it.
static SETTINGS_LOCK: Mutex<()> = Mutex::new(());

/// Reads the settings file. A missing file is `None`. A file that is not valid JSON is moved aside
/// (`settings.json.corrupt-<unix time>`) and treated as missing, so the next save does not silently
/// overwrite what the user might want to recover.
fn read_settings(dir: &Path) -> Result<Option<String>, String> {
    let path = dir.join(SETTINGS_FILE);
    let contents = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Failed to read {}: {}", path.display(), e)),
    };
    if serde_json::from_str::<serde_json::Value>(&contents).is_ok() {
        return Ok(Some(contents));
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup = dir.join(format!("{}.corrupt-{}", SETTINGS_FILE, stamp));
    fs::rename(&path, &backup).map_err(|e| format!("Failed to set aside broken {}: {}", path.display(), e))?;
    Ok(None)
}

/// Writes the settings file atomically (temp file in the same directory, then rename), so quitting or a
/// crash mid-write cannot leave a truncated file.
fn write_settings(dir: &Path, contents: &str) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
    let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| format!("Failed to create temp file: {}", e))?;
    tmp.write_all(contents.as_bytes())
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    tmp.persist(dir.join(SETTINGS_FILE))
        .map_err(|e| format!("Failed to replace settings file: {}", e.error))?;
    Ok(())
}

fn with_settings_lock<T>(f: impl FnOnce() -> T) -> T {
    let _guard = SETTINGS_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    f()
}

#[command]
pub async fn load_user_settings(app: AppHandle) -> Result<Option<String>, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Could not find app_config_dir: {}", e))?;
    tauri::async_runtime::spawn_blocking(move || with_settings_lock(|| read_settings(&dir)))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[command]
pub async fn save_user_settings(app: AppHandle, contents: String) -> Result<(), String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Could not find app_config_dir: {}", e))?;
    tauri::async_runtime::spawn_blocking(move || with_settings_lock(|| write_settings(&dir, &contents)))
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_is_none() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(read_settings(tmp.path()).unwrap(), None);
    }

    #[test]
    fn written_settings_are_read_back_and_overwritten() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("nested");
        write_settings(&dir, r#"{"state":{"a":1},"version":3}"#).unwrap();
        assert_eq!(
            read_settings(&dir).unwrap().as_deref(),
            Some(r#"{"state":{"a":1},"version":3}"#)
        );
        write_settings(&dir, r#"{"state":{"a":2},"version":3}"#).unwrap();
        assert_eq!(
            read_settings(&dir).unwrap().as_deref(),
            Some(r#"{"state":{"a":2},"version":3}"#)
        );
    }

    #[test]
    fn broken_json_is_set_aside_and_treated_as_missing() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join(SETTINGS_FILE), "{ not json").unwrap();
        assert_eq!(read_settings(tmp.path()).unwrap(), None);
        assert!(!tmp.path().join(SETTINGS_FILE).exists());
        let kept: Vec<_> = fs::read_dir(tmp.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("settings.json.corrupt-"))
            .collect();
        assert_eq!(kept.len(), 1);
        assert_eq!(fs::read_to_string(kept[0].path()).unwrap(), "{ not json");
    }
}
