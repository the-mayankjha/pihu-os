//! Start Google OAuth only after a dedicated callback listener is ready.
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;
use tauri::Manager;
#[tauri::command]
pub async fn google_oauth_start(app: tauri::AppHandle, client_id: String, client_secret: String) -> Result<serde_json::Value,String> {
    if client_id.trim().is_empty() || client_secret.trim().is_empty() { return Err("Enter your Google Desktop OAuth client ID and secret first.".into()); }
    let resource = app.path().resource_dir().map_err(|e|e.to_string())?.join("pihu_mcps/mcp/servers/google_oauth_server.py");
    let script = if resource.exists(){resource}else{std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("pihu_mcps/mcp/servers/google_oauth_server.py")};
    tauri::async_runtime::spawn_blocking(move || {
        let mut child = Command::new(crate::get_python_cmd()).arg(script).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|e|format!("Could not start Google OAuth listener: {e}"))?;
        let config=serde_json::json!({"client_id":client_id.trim(),"client_secret":client_secret.trim()});
        let write_result = child.stdin.take().ok_or("OAuth listener has no input").and_then(|mut input|writeln!(input,"{config}").map_err(|_|"Could not initialize Google OAuth listener"));
        if let Err(error)=write_result { let _=child.kill(); let _=child.wait(); return Err(error.to_string()); }
        let stdout=child.stdout.take().ok_or("OAuth listener has no output")?;
        let (tx,rx)=mpsc::channel();
        std::thread::spawn(move || {
            let mut reader=BufReader::new(stdout);
            let mut line=String::new();
            let _=reader.read_line(&mut line);
            let _=tx.send(line);
            // Drain completion output without logging account details or tokens.
            let mut discard=String::new();
            while reader.read_line(&mut discard).unwrap_or(0)>0 {discard.clear();}
        });
        let ready=rx.recv_timeout(Duration::from_secs(8)).ok().and_then(|line|serde_json::from_str::<serde_json::Value>(&line).ok());
        let ready=match ready {Some(value) if value["auth_url"].is_string()=>value,_=>{let _=child.kill();let _=child.wait();return Err("Google OAuth callback listener did not start. Check Python installation and retry.".into());}};
        #[cfg(target_os="macos")]
        let opened=Command::new("/usr/bin/open").arg(ready["auth_url"].as_str().unwrap()).status();
        #[cfg(target_os="windows")]
        let opened=Command::new("cmd").args(["/C","start","",ready["auth_url"].as_str().unwrap()]).status();
        #[cfg(all(not(target_os="macos"),not(target_os="windows")))]
        let opened=Command::new("xdg-open").arg(ready["auth_url"].as_str().unwrap()).status();
        if !opened.map(|s|s.success()).unwrap_or(false) {let _=child.kill();let _=child.wait();return Err("Could not open Google sign-in in your browser.".into());}
        std::thread::spawn(move || {let _=child.wait();});
        Ok(serde_json::json!({"started":true,"port":ready["port"]}))
    }).await.map_err(|e|e.to_string())?
}
