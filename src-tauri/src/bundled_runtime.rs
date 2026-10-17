use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::Manager;
static ROOT: OnceLock<PathBuf> = OnceLock::new();
pub fn initialize(root: PathBuf) { let _ = ROOT.set(root); }
pub fn python() -> Option<PathBuf> {
    ROOT.get().map(|root| root.join(if cfg!(windows) { "runtime/python/python.exe" } else { "runtime/python/bin/python3" }))
}
pub fn node() -> PathBuf {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    let bundled = ROOT.get().map(|root| root.join("runtime/node").join(name));
    if let Some(path) = bundled { if !cfg!(debug_assertions) || path.is_file() { return path; } }
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../bin/shared-runtime/node_modules/node/bin").join(name)
}
pub fn configure(command: &mut std::process::Command) {
    let Some(root) = ROOT.get() else { return; };
    if cfg!(debug_assertions) {
        command.env("PIHU_DEVELOPMENT_RUNTIME", "1")
            .env("PIHU_NODE_EXECUTABLE", node()).env("PYTHONDONTWRITEBYTECODE", "1")
            .env_remove("PYTHONHOME").env_remove("PYTHONPATH");
        let mut paths = Vec::new();
        if let Some(parent) = node().parent() { paths.push(parent.to_path_buf()); }
        if let Some(path) = std::env::var_os("PATH") { paths.extend(std::env::split_paths(&path)); }
        if let Ok(path) = std::env::join_paths(paths) { command.env("PATH", path); }
        return;
    }
    if !root.join("runtime/python").is_dir() { return; }
    command.env("PIHU_BUNDLED_RUNTIME", "1")
        .env("PIHU_RESOURCE_DIR", root)
        .env("PIHU_NODE_EXECUTABLE", root.join(if cfg!(windows) { "runtime/node/node.exe" } else { "runtime/node/node" }))
        .env("PYTHONDONTWRITEBYTECODE", "1")
        .env("PYTHONNOUSERSITE", "1")
        .env_remove("PYTHONHOME").env_remove("PYTHONPATH")
        .env("HF_HUB_OFFLINE", "1").env("TRANSFORMERS_OFFLINE", "1")
        .env("HF_HUB_CACHE", root.join("runtime/tts/hub"))
        .env("PLAYWRIGHT_BROWSERS_PATH", root.join("runtime/browser"));
    #[cfg(target_os = "linux")]
    command.env("LD_LIBRARY_PATH", root.join("runtime/native"));
    let mut paths = vec![root.join("runtime/node")];
    if let Some(python) = python() { if let Some(parent) = python.parent() { paths.push(parent.to_path_buf()); } }
    if let Some(path) = std::env::var_os("PATH") { paths.extend(std::env::split_paths(&path)); }
    if let Ok(path) = std::env::join_paths(paths) { command.env("PATH", path); }
}
#[tauri::command]
pub async fn diagnose_runtime(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let root = if cfg!(debug_assertions) { PathBuf::from(env!("CARGO_MANIFEST_DIR")) } else { app.path().resource_dir().map_err(|e| e.to_string())? };
    tauri::async_runtime::spawn_blocking(move || diagnose(&root)).await.map_err(|e| e.to_string())?
}
fn diagnose(root: &Path) -> Result<serde_json::Value, String> {
    let python = crate::get_python_cmd();
    // Bound execution; redirect to a temporary file so a full pipe cannot deadlock.
    let report = std::env::temp_dir().join(format!("pihu-diagnosis-{}-{}.json", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos()));
    let file = std::fs::File::create(&report).map_err(|e| e.to_string())?;
    let mut command = crate::background_process::command(python);
    if cfg!(debug_assertions) { command.arg(root.join("python/runtime_check.py")).arg("--development"); } else { command.arg(root.join("python/runtime_check.py")); }
    let mut child = command.arg("--root").arg(root)
        .stdout(file).stderr(std::process::Stdio::null()).spawn().map_err(|e| format!("Cannot start bundled Python: {e}"))?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(45);
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => break,
            None if std::time::Instant::now() >= deadline => {
                let _ = child.kill(); let _ = child.wait(); let _ = std::fs::remove_file(&report);
                return Err("Runtime diagnosis timed out after 45 seconds".into());
            }
            None => std::thread::sleep(std::time::Duration::from_millis(100)),
        }
    }
    let contents = std::fs::read(&report).map_err(|e| e.to_string());
    let _ = std::fs::remove_file(&report);
    let mut report: serde_json::Value = serde_json::from_slice(&contents?).map_err(|e| format!("Runtime diagnosis failed to produce a report: {e}"))?;
    let wake = crate::wakeword::HEALTH.lock().map_err(|e| e.to_string())?;
    report["wakeWord"] = serde_json::json!({"online": wake.0, "error": wake.1});
    Ok(report)
}
