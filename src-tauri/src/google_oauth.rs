//! Start the PIHU-hosted Google OAuth flow with a loopback callback.
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;
use tauri::Manager;

#[tauri::command]
pub async fn google_oauth_start(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("pihu_mcps/mcp/servers/google_oauth_server.py");
    let script = if resource.exists() {
        resource
    } else {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("pihu_mcps/mcp/servers/google_oauth_server.py")
    };

    tauri::async_runtime::spawn_blocking(move || {
        let mut child = Command::new(crate::get_python_cmd())
            .arg(script)
            .env("PIHU_OAUTH_BROKER", "https://pihu.nfks.co.in/api/v2/oauth/google")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Could not start Google OAuth callback: {e}"))?;
        let stdout = child.stdout.take().ok_or("OAuth callback has no output")?;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            let _ = reader.read_line(&mut line);
            let _ = tx.send(line);
            let mut discard = String::new();
            while reader.read_line(&mut discard).unwrap_or(0) > 0 {
                discard.clear();
            }
        });
        let first_line = rx
            .recv_timeout(Duration::from_secs(15))
            .map_err(|_| "PIHU sign-in service did not respond. Check your network and try again.".to_string())?;
        let ready: serde_json::Value = serde_json::from_str(&first_line).map_err(|_| {
            "PIHU could not prepare Google sign-in. Check the OAuth configuration on pihu.nfks.co.in.".to_string()
        })?;
        if let Some(error) = ready["error"].as_str() {
            return Err(error.to_string());
        }
        let auth_url = ready["auth_url"]
            .as_str()
            .filter(|url| url.starts_with("https://accounts.google.com/"))
            .ok_or_else(|| "PIHU returned an invalid Google sign-in URL.".to_string())?;

        #[cfg(target_os = "macos")]
        let opened = Command::new("/usr/bin/open").arg(auth_url).status();
        #[cfg(target_os = "windows")]
        let opened = Command::new("cmd").args(["/C", "start", "", auth_url]).status();
        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        let opened = Command::new("xdg-open").arg(auth_url).status();

        if !opened.map(|status| status.success()).unwrap_or(false) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Could not open Google sign-in in your browser.".into());
        }
        std::thread::spawn(move || {
            let _ = child.wait();
        });
        Ok(serde_json::json!({"started": true, "port": ready["port"]}))
    })
    .await
    .map_err(|e| e.to_string())?
}
