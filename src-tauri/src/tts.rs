use std::process::Child;
use std::sync::Mutex;
use tauri::Manager;

static PROCESS: Mutex<Option<Child>> = Mutex::new(None);

pub fn stop_tts_server() {
    if let Ok(mut process) = PROCESS.lock() {
        if let Some(mut child) = process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn start_tts_server(app: tauri::AppHandle) {
    // Keep ownership in app state rather than an immortal background thread.
    let root = if cfg!(debug_assertions) {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    } else {
        match app.path().resource_dir() {
            Ok(path) => path,
            Err(error) => { eprintln!("Could not locate TTS resources: {error}"); return; }
        }
    };
    let mut process = match PROCESS.lock() { Ok(process) => process, Err(_) => return };
    if let Some(child) = process.as_mut() {
        if matches!(child.try_wait(), Ok(None)) { return; }
    }
    let mut command = crate::background_process::command(crate::get_python_cmd());
    command.arg(root.join("python/tts_server.py"))
        .current_dir(&root)
        .env("PIHU_RESOURCE_DIR", &root)
        .env("HF_HUB_CACHE", root.join("runtime/tts/hub"))
        .env("PIHU_PARENT_PID", std::process::id().to_string());
    match command.spawn() {
        Ok(child) => { *process = Some(child); }
        Err(error) => eprintln!("Failed to start TTS server: {error}"),
    }
}
