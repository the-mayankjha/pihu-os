//! MCP manager owns service ports and the installed WhatsApp bridge process.
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

struct Bridge { child: Child, port: u16, descriptor: PathBuf }
impl Drop for Bridge {
    fn drop(&mut self) {
        let _ = self.child.kill(); let _ = self.child.wait();
        let _ = std::fs::remove_file(&self.descriptor);
    }
}
#[derive(Default)]
pub struct WhatsAppMcpState { bridge: Mutex<Option<Bridge>> }

pub fn stop(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<WhatsAppMcpState>() {
        *state.bridge.lock().map_err(|_| "WhatsApp process lock failed")? = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn whatsapp_mcp_start(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = crate::mcp_market::package_lock("pihu-whatsapp-mcp").lock().map_err(|_| "MCP package lock failed")?;
        let asset = if cfg!(windows) { "native/bridge.exe" } else { "native/bridge" };
        let executable = crate::mcp_market::installed_asset(&app, "pihu-whatsapp-mcp", asset)?;
        let state = app.state::<WhatsAppMcpState>();
        let mut bridge = state.bridge.lock().map_err(|_| "WhatsApp process lock failed")?;
        if let Some(active) = bridge.as_mut() {
            if active.child.try_wait().map_err(|e| e.to_string())?.is_none() {
                return Ok(serde_json::json!({"port":active.port}));
            }
            *bridge = None;
        }
        let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).ok_or("User home directory is unavailable")?;
        let data = PathBuf::from(home).join(".pihu");
        let services = data.join("mcp-services");
        std::fs::create_dir_all(&services).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(data.join("whatsapp")).map_err(|e| e.to_string())?;
        let descriptor = services.join("pihu-whatsapp-mcp.json");
        let ready = services.join(format!(".whatsapp-{}-{}.ready", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos()));
        let log = std::fs::OpenOptions::new().create(true).append(true).open(data.join("whatsapp/bridge.log")).map_err(|e| e.to_string())?;
        let errors = log.try_clone().map_err(|e| e.to_string())?;
        // Child binds before reporting its actual port. There is no release-and-rebind gap.
        let child = crate::background_process::command(executable)
            .env("PIHU_MCP_PORT", "8080").env("PIHU_MCP_ALLOW_DYNAMIC_PORT", "1")
            .env("PIHU_MCP_READY_FILE", &ready)
            .current_dir(data.join("whatsapp")).stdin(Stdio::null()).stdout(log).stderr(errors)
            .spawn().map_err(|e| format!("Cannot start installed WhatsApp bridge: {e}"))?;
        *bridge = Some(Bridge { child, port:0, descriptor: descriptor.clone() });
        let result = (|| {
            for _ in 0..100 {
                let active = bridge.as_mut().ok_or("WhatsApp process is missing")?;
                if let Some(status) = active.child.try_wait().map_err(|e| e.to_string())? {
                    return Err(format!("WhatsApp bridge exited ({status}). Check ~/.pihu/whatsapp/bridge.log"));
                }
                if let Ok(bytes) = std::fs::read(&ready) {
                    if let Ok(endpoint) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                        let port = endpoint["port"].as_u64().filter(|port| *port > 0 && *port <= 65535);
                        if endpoint["pid"].as_u64() == Some(active.child.id() as u64) && endpoint["id"] == "pihu-whatsapp-mcp" {
                            if let Some(port) = port {
                                let address: SocketAddr = format!("127.0.0.1:{port}").parse().map_err(|_| "Invalid assigned port")?;
                                if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
                                    active.port = port as u16;
                                    // Rename is atomic on Unix; remove a stale descriptor first on Windows.
                                    #[cfg(windows)]
                                    let _ = std::fs::remove_file(&descriptor);
                                    std::fs::rename(&ready, &descriptor).map_err(|e| e.to_string())?;
                                    return Ok(serde_json::json!({"port":port}));
                                }
                            }
                        }
                    }
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err("WhatsApp bridge did not report its managed port within 10 seconds. Repair the MCP in the Market.".into())
        })();
        let _ = std::fs::remove_file(&ready);
        if result.is_err() { *bridge = None; }
        result
    }).await.map_err(|e| e.to_string())?
}
