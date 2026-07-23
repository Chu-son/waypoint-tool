use tauri::command;
#[command]
pub fn test_open_devtools(window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    window.open_devtools();
}
