// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Linux環境でのGBM EGL初期化エラー（アボート）を回避するため、DMA-BUFレンダラーを無効化
        println!("Info: [Linux] Setting WEBKIT_DISABLE_DMABUF_RENDERER=1 to prevent GBM EGL display initialization abort.");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    waypoint_tool_lib::run()
}
