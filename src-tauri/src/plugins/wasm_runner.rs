use std::process::{Command, Stdio};
use std::io::Write;

pub fn run_wasm_plugin(
    wasm_path: &str,
    context_json: &str,
) -> Result<serde_json::Value, String> {
    
    // 【WebAssembly 実行アーキテクチャの背景】
    // WebAssembly(Wasm) プラグインの実行には、WASI (WebAssembly System Interface) に準拠した
    // 外部の `wasmtime` CLI に依存する設計を取っています。
    // Tauri/Rust 内部で Wasm ランタイム（wasmtime クレートなど）を直接組み込むことも可能ですが、
    // クロスコンパイルのビルド肥大化・依存関係の複雑化を避けるため、あえて CLI コマンドを spawn() する
    // 軽量なプロセス分離アーキテクチャを採用しました。入力は stdin から流し込みます。
    let mut child = Command::new("wasmtime")
        .arg(wasm_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn wasmtime CLI. Is wasmtime installed in PATH?\nError: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(context_json.as_bytes())
            .map_err(|e| format!("Failed to write to wasmtime stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for wasmtime process: {}", e))?;

    if !output.status.success() {
        let err_str = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Wasmtime execution failed:\n{}", err_str));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    
    let result: serde_json::Value = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("Failed to parse wasm plugin output as JSON: {}\nOutput was:\n{}", e, stdout_str))?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_run_wasm_plugin_non_existent_file() {
        // This will likely fail either at spawn (if wasmtime missing) 
        // or during wasmtime execution (if wasmtime exists but file doesn't).
        let res = run_wasm_plugin("non_existent.wasm", "{}");
        assert!(res.is_err());
        let err = res.unwrap_err();
        // Check if it's one of the expected error messages
        assert!(err.contains("Failed to spawn wasmtime") || err.contains("Wasmtime execution failed"));
    }
}
