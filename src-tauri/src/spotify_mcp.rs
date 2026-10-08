//! Persistent local adapter for Marcel Marais's Spotify MCP and PIHU OAuth.
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use tauri::Manager;

struct Session { child: Child, input: ChildStdin, responses: mpsc::Receiver<String> }
impl Drop for Session {
    fn drop(&mut self) {
        let _ = writeln!(self.input, "{{\"action\":\"shutdown\"}}");
        let _ = self.input.flush();
        for _ in 0..20 {
            if self.child.try_wait().ok().flatten().is_some() { return; }
            std::thread::sleep(Duration::from_millis(100));
        }
        let _ = self.child.kill(); let _ = self.child.wait();
    }
}
#[derive(Default)]
pub struct SpotifyMcpState { session: Mutex<Option<Session>> }

fn start(script: &std::path::Path) -> Result<Session,String> {
    let node = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "node"].into_iter().find(|p| *p=="node" || std::path::Path::new(p).exists()).unwrap_or("node");
    let mut command = Command::new(node);
    for (key, _) in std::env::vars_os() {
        let name = key.to_string_lossy();
        if !spotify_environment_allowed(&name) { command.env_remove(key); }
    }
    let mut child = command.arg(script).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit()).spawn().map_err(|e|format!("Spotify MCP needs Node.js installed: {e}"))?;
    let input = child.stdin.take().ok_or("Missing Spotify stdin")?;
    let stdout = child.stdout.take().ok_or("Missing Spotify stdout")?;
    let (tx,responses) = mpsc::channel();
    std::thread::spawn(move || { for line in BufReader::new(stdout).lines() { match line { Ok(line) if line.len()<=1048576 => { if tx.send(line).is_err(){break;} }, _ => break } } });
    Ok(Session{child,input,responses})
}
#[tauri::command]
pub async fn spotify_mcp_action(app: tauri::AppHandle, payload: serde_json::Value) -> Result<serde_json::Value,String> {
    let request = serde_json::to_string(&payload).map_err(|e|e.to_string())?;
    if !payload.is_object() || request.len()>32768 { return Err("Invalid Spotify request".into()); }
    let root = app.path().resource_dir().map_err(|e|e.to_string())?;
    let bundled = root.join("_up_/bin/spotify-runtime/bridge.mjs");
    let script = if bundled.exists(){bundled}else{std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../bin/spotify-runtime/bridge.mjs")};
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SpotifyMcpState>();
        let mut session = state.session.lock().map_err(|_|"Spotify MCP session lock failed")?;
        if session.is_none(){*session=Some(start(&script)?);}
        let active=session.as_mut().ok_or("Spotify session missing")?;
        let result = (|| {
            writeln!(active.input,"{request}").map_err(|e|e.to_string())?;
            active.input.flush().map_err(|e|e.to_string())?;
            let line=active.responses.recv_timeout(Duration::from_secs(55)).map_err(|_|"Spotify MCP stopped or timed out. Check Spotify/Node installation and retry.".to_string())?;
            let value:serde_json::Value=serde_json::from_str(&line).map_err(|e|e.to_string())?;
            if value["success"]!=true { return Err(value["error"].as_str().unwrap_or("Spotify action failed").to_string()); }
            Ok(value["data"].clone())
        })();
        // A timeout/disconnected pipe invalidates protocol state; never reuse stale replies.
        if result.as_ref().err().map(|e|e.contains("stopped or timed out")||e.contains("pipe")).unwrap_or(false){*session=None;}
        result
    }).await.map_err(|e|e.to_string())?
}


fn spotify_environment_allowed(key: &str) -> bool {
    !key.starts_with("DYLD_") && !matches!(key, "LD_PRELOAD" | "LD_LIBRARY_PATH")
}
#[cfg(test)]
mod tests {
    #[test]
    fn cargo_loader_overrides_are_not_inherited_by_spotify_runtime() {
        for key in ["DYLD_LIBRARY_PATH", "DYLD_FRAMEWORK_PATH", "DYLD_INSERT_LIBRARIES", "LD_PRELOAD", "LD_LIBRARY_PATH"] {
            assert!(!super::spotify_environment_allowed(key));
        }
        for key in ["PATH", "HOME", "HTTPS_PROXY", "LANG"] { assert!(super::spotify_environment_allowed(key)); }
    }
}
