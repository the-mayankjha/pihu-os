use serde_json::Value;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use std::io::{BufRead, BufReader, Read};
use std::process::Stdio;

fn agent_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).map_err(|e| e.to_string())?;
    let bundled = app.path().resource_dir().map_err(|e| e.to_string())?.join("mcp-agent-bundle/agent");
    if !cfg!(debug_assertions) { return Ok(bundled); }
    let candidates = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("pihu_mcps/agent"),
        PathBuf::from(format!("{home}/.pihu-os/agent")),
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("mcp-agent-bundle/agent"),
    ];
    candidates
        .into_iter()
        .find(|p| p.join("pihu/mcp/cli.py").is_file())
        .ok_or_else(|| {
            "PIHU MCP runtime is missing. Re-run setup or reinstall the app.".to_string()
        })
}

fn run(app: &tauri::AppHandle, args: &[&str]) -> Result<String, String> {
    let agent = agent_path(app)?;
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
    let server_candidates = [
        resource_dir.join("mcp-agent-bundle/mcp/servers"),
        PathBuf::from(format!("{home}/.pihu-os/mcp/servers")),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("pihu_mcps/mcp/servers"),
        resource_dir.join("mcp-agent-bundle/mcp/servers"),
    ];
    let servers = server_candidates
        .into_iter()
        .find(|p| p.join("pihu_file_mcp.py").is_file())
        .ok_or_else(|| "Built-in MCP server files are missing.".to_string())?;
    let mut child = crate::background_process::command(crate::get_python_cmd())
        .args(["-m", "pihu.mcp.cli"])
        .args(args)
        .env("PYTHONPATH", agent)
        .env("PIHU_MCP_SERVERS_DIR", servers)
        .env("PIHU_APP_VERSION", app.package_info().version.to_string())
        .env("PYTHONUNBUFFERED", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start MCP runtime: {e}"))?;
    let mut stderr = child.stderr.take().ok_or("Missing MCP error stream")?;
    let errors = std::thread::spawn(move || {
        let mut text = String::new();
        let mut buffer = [0u8; 8192];
        while let Ok(count) = stderr.read(&mut buffer) {
            if count == 0 { break; }
            if text.len() < 1024 * 1024 { text.push_str(&String::from_utf8_lossy(&buffer[..count])); }
        }
        text
    });
    let stdout = child.stdout.take().ok_or("Missing MCP output stream")?;
    let mut result = String::new();
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|e| e.to_string())?;
        if let Some(payload) = line.strip_prefix("PIHU_MARKET_PROGRESS:") {
            if let Ok(payload) = serde_json::from_str::<Value>(payload) {
                let _ = app.emit("mcp-package-progress", payload);
            }
        } else if result.len() < 1024 * 1024 {
            result.push_str(&line);
            result.push('\n');
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let stderr = errors.join().unwrap_or_default();
    if !status.success() {
        return Err(stderr.trim().to_string().if_empty(&result.trim().to_string().if_empty("MCP operation failed")));
    }
    Ok(result.trim().to_string())
}

trait IfEmpty {
    fn if_empty(self, fallback: &str) -> String;
}
impl IfEmpty for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.into()
        } else {
            self
        }
    }
}

#[tauri::command]
pub async fn mcp_install_package(app: tauri::AppHandle, package_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = package_lock(&package_id).lock().map_err(|_| "MCP package lock failed")?;
        stop_adapter(&app, &package_id)?;
        run(&app, &["install", &package_id])
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn mcp_list_installed(app: tauri::AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = run(&app, &["list", "--json"])?;
        serde_json::from_str(&output).map_err(|e| format!("Invalid MCP runtime response: {e}"))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn mcp_list_tools(app: tauri::AppHandle) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = run(&app, &["tools", "--json"])?;
        serde_json::from_str(&output).map_err(|e| format!("Invalid MCP tool response: {e}"))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn mcp_call_tool(
    app: tauri::AppHandle,
    server_id: String,
    tool_name: String,
    arguments: Value,
) -> Result<String, String> {
    let args = serde_json::to_string(&arguments).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || run(&app, &["call", &server_id, &tool_name, &args])).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn mcp_manage_package(app: tauri::AppHandle, package_id: String, action: String, configuration: Option<Value>) -> Result<String, String> {
    if !["remove", "enable", "disable", "diagnose", "rollback", "configure"].contains(&action.as_str()) {
        return Err("Unsupported MCP operation".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = package_lock(&package_id).lock().map_err(|_| "MCP package lock failed")?;
        if action != "diagnose" { stop_adapter(&app, &package_id)?; }
        let configuration = configuration.unwrap_or_else(|| serde_json::json!({})).to_string();
        let mut args = vec![action.as_str(), package_id.as_str()];
        if action == "configure" { args.push(&configuration); }
        run(&app, &args)
    }).await.map_err(|e| e.to_string())?
}

static BROWSER_PACKAGE: std::sync::Mutex<()> = std::sync::Mutex::new(());
static SPOTIFY_PACKAGE: std::sync::Mutex<()> = std::sync::Mutex::new(());
static WHATSAPP_PACKAGE: std::sync::Mutex<()> = std::sync::Mutex::new(());
static OTHER_PACKAGES: std::sync::Mutex<()> = std::sync::Mutex::new(());
pub fn package_lock(id: &str) -> &'static std::sync::Mutex<()> {
    match id { "browser-mcp" => &BROWSER_PACKAGE, "spotify-mcp" => &SPOTIFY_PACKAGE,
        "pihu-whatsapp-mcp" => &WHATSAPP_PACKAGE, _ => &OTHER_PACKAGES }
}
pub fn installed_asset(app: &tauri::AppHandle, id: &str, asset: &str) -> Result<PathBuf, String> {
    let output = run(app, &["locate", id, asset])?;
    let result: Value = serde_json::from_str(&output).map_err(|e| e.to_string())?;
    result["path"].as_str().map(PathBuf::from).ok_or("MCP package returned an invalid path".into())
}
fn stop_adapter(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    match id {
        "browser-mcp" => crate::browser_mcp::stop(app),
        "spotify-mcp" => crate::spotify_mcp::stop(app),
        "pihu-whatsapp-mcp" => crate::whatsapp_mcp::stop(app),
        _ => Ok(())
    }
}
