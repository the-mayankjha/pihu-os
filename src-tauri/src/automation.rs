//! Native macOS automation. All user input travels as argv, never executable script.
use serde::Serialize;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const APP_SCRIPT: &str = include_str!("../python/automations/macos/pihu-macos-automation-v2/pihu_automation/macos/app_control.applescript");
const ACTIONS: &[&str] = &[
    "open",
    "quit",
    "focus",
    "hide",
    "minimize",
    "restore",
    "maximize",
    "fullscreen",
    "exit_fullscreen",
    "close_window",
    "windows",
    "move",
    "resize",
    "snap_left",
    "snap_right",
];

#[derive(Serialize)]
pub struct AutomationResult {
    action: String,
    app: String,
    message: String,
}

fn validate(
    action: &str,
    window: u32,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<(), String> {
    if !ACTIONS.contains(&action) {
        return Err("Unsupported app action".into());
    }
    if window == 0 || window > 100 {
        return Err("Window index must be between 1 and 100".into());
    }
    if action == "move" && (x.is_none() || y.is_none()) {
        return Err("Move requires x and y coordinates".into());
    }
    if action == "resize" && (width.unwrap_or(0) <= 0 || height.unwrap_or(0) <= 0) {
        return Err("Resize requires positive width and height".into());
    }
    Ok(())
}

fn execute(
    app: String,
    action: String,
    window: u32,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<AutomationResult, String> {
    if !cfg!(target_os = "macos") {
        return Err("App automation currently requires macOS".into());
    }
    validate(&action, window, x, y, width, height)?;
    if app.contains('\0') || app.len() > 512 {
        return Err("Invalid application name".into());
    }
    let args = [
        app.clone(),
        action.clone(),
        window.to_string(),
        x.unwrap_or(0).to_string(),
        y.unwrap_or(0).to_string(),
        width.unwrap_or(0).to_string(),
        height.unwrap_or(0).to_string(),
    ];
    let mut child = Command::new("/usr/bin/osascript")
        .args(["-e", APP_SCRIPT])
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start AppleScript: {e}"))?;
    let started = Instant::now();
    loop {
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            break;
        }
        if started.elapsed() > Duration::from_secs(12) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("App action timed out. Check permission prompts or unsaved-document dialogs; no force-quit was performed.".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if error.contains("-1743")
            || error.contains("-1719")
            || error.contains("-25211")
            || error.contains("assistive access")
        {
            return Err(format!("macOS permission needed: grant PIHU OS Accessibility and Automation access in System Settings > Privacy & Security. {error}"));
        }
        return Err(error);
    }
    Ok(AutomationResult {
        action,
        app,
        message: String::from_utf8_lossy(&output.stdout).trim().to_string(),
    })
}

#[tauri::command]
pub async fn macos_app_action(
    app: Option<String>,
    action: String,
    window: Option<u32>,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<i32>,
    height: Option<i32>,
) -> Result<AutomationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        execute(
            app.unwrap_or_default(),
            action,
            window.unwrap_or(1),
            x,
            y,
            width,
            height,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

fn scan_apps(
    directory: &std::path::Path,
    depth: u8,
    names: &mut std::collections::BTreeSet<String>,
) {
    let entries = match std::fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("app") {
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                names.insert(name.to_string());
            }
        } else if depth > 0 && entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            scan_apps(&path, depth - 1, names);
        }
    }
}

#[tauri::command]
pub async fn macos_list_apps() -> Result<Vec<String>, String> {
    if !cfg!(target_os = "macos") {
        return Err("App discovery currently requires macOS".into());
    }
    tauri::async_runtime::spawn_blocking(|| {
        let mut names = std::collections::BTreeSet::new();
        for root in [
            "/Applications",
            "/System/Applications",
            "/System/Library/CoreServices/Applications",
        ] {
            scan_apps(std::path::Path::new(root), 2, &mut names);
        }
        if let Ok(home) = std::env::var("HOME") {
            scan_apps(
                &std::path::PathBuf::from(home).join("Applications"),
                2,
                &mut names,
            );
        }
        names.into_iter().collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_actions_and_geometry_are_rejected() {
        assert!(validate("kill", 1, None, None, None, None).is_err());
        assert!(validate("maximize", 0, None, None, None, None).is_err());
        assert!(validate("move", 1, Some(20), None, None, None).is_err());
        assert!(validate("resize", 1, None, None, Some(-1), Some(600)).is_err());
        assert!(validate("move", 2, Some(-100), Some(10), None, None).is_ok());
    }
    #[test]
    fn nested_apps_are_discovered_without_traversing_bundles() {
        let root = std::env::temp_dir().join(format!("pihu-app-scan-{}", std::process::id()));
        std::fs::create_dir_all(root.join("Utilities/Activity Monitor.app/Contents/Fake.app"))
            .unwrap();
        let mut names = std::collections::BTreeSet::new();
        scan_apps(&root, 2, &mut names);
        assert_eq!(
            names.into_iter().collect::<Vec<_>>(),
            vec!["Activity Monitor"]
        );
        std::fs::remove_dir_all(root).unwrap();
    }
}

/// Run the existing Python automation with data on stdin, never executable user text.
#[tauri::command]
pub async fn macos_ui_action(app: tauri::AppHandle, payload: serde_json::Value) -> Result<serde_json::Value, String> {
    use tauri::Manager;
    if !cfg!(target_os = "macos") { return Err("UI automation requires macOS".into()); }
    let relative = "python/automations/macos/pihu-macos-automation-v2/ui_cli.py";
    let bundled = app.path().resource_dir().map_err(|e| e.to_string())?.join(relative);
    let script = if bundled.exists() { bundled } else { std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(relative) };
    let request = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    if !payload.is_object() || request.len() > 32768 { return Err("Invalid UI request".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{Read, Write};
        let mut child = Command::new(crate::get_python_cmd()).arg(script)
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .spawn().map_err(|e| format!("Could not start UI automation: {e}"))?;
        let stdout = child.stdout.take().ok_or("Missing stdout")?;
        let stderr = child.stderr.take().ok_or("Missing stderr")?;
        let reader = std::thread::spawn(move || { let mut bytes = Vec::new(); stdout.take(1048576).read_to_end(&mut bytes).map(|_| bytes) });
        let errors = std::thread::spawn(move || { let mut bytes = Vec::new(); stderr.take(65536).read_to_end(&mut bytes).map(|_| bytes) });
        child.stdin.take().ok_or("Missing stdin")?.write_all(&request).map_err(|e| e.to_string())?;
        let started = Instant::now();
        while child.try_wait().map_err(|e| e.to_string())?.is_none() {
            if started.elapsed() > Duration::from_secs(15) {
                let _ = child.kill(); let _ = child.wait();
                return Err("UI action timed out; check macOS Accessibility and Automation permissions".into());
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let output = reader.join().map_err(|_| "UI output reader failed")?.map_err(|e| e.to_string())?;
        let error = errors.join().map_err(|_| "UI error reader failed")?.map_err(|e| e.to_string())?;
        let response: serde_json::Value = serde_json::from_slice(&output).map_err(|_| format!("UI automation failed: {}", String::from_utf8_lossy(&error)))?;
        if response["success"] != true { return Err(response["error"].as_str().unwrap_or("UI action failed").to_string()); }
        Ok(response["data"].clone())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn macos_browser_navigate(browser: Option<String>, url: String) -> Result<serde_json::Value, String> {
    if !cfg!(target_os = "macos") { return Err("Browser automation requires macOS".into()); }
    if url.len() > 8192 || !(url.starts_with("https://www.google.com/search?") || url.starts_with("https://www.youtube.com/results?")) {
        return Err("Only Google and YouTube search URLs are supported".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new("/usr/bin/open");
        if let Some(name) = browser.filter(|s| !s.is_empty()) { command.args(["-a", &name]); }
        let output = command.arg(&url).output().map_err(|e| e.to_string())?;
        if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
        Ok(serde_json::json!({"message": "Opened search in the browser.", "url": url}))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn macos_frontmost_app() -> Result<String, String> {
    if !cfg!(target_os = "macos") { return Err("Foreground discovery requires macOS".into()); }
    tauri::async_runtime::spawn_blocking(|| {
        let output = Command::new("/usr/bin/osascript").args(["-e", "use framework \"AppKit\"\nreturn (current application's NSWorkspace's sharedWorkspace()'s frontmostApplication()'s localizedName()) as text"]).output().map_err(|e| e.to_string())?;
        if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
        let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if name.is_empty() { return Err("No foreground application found".into()); }
        Ok(name)
    }).await.map_err(|e| e.to_string())?
}
