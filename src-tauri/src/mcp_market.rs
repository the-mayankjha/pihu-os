use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;

fn agent_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let candidates = [
        PathBuf::from(format!("{home}/.pihu-os/agent")),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("pihu_mcps/agent"),
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
    let home = std::env::var("HOME").unwrap_or_default();
    let server_candidates = [
        PathBuf::from(format!("{home}/.pihu-os/mcp/servers")),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("pihu_mcps/mcp/servers"),
        resource_dir.join("mcp-agent-bundle/mcp/servers"),
    ];
    let servers = server_candidates
        .into_iter()
        .find(|p| p.join("pihu_file_mcp.py").is_file())
        .ok_or_else(|| "Built-in MCP server files are missing.".to_string())?;
    let output = crate::background_process::command(crate::get_python_cmd())
        .args(["-m", "pihu.mcp.cli"])
        .args(args)
        .env("PYTHONPATH", agent)
        .env("PIHU_MCP_SERVERS_DIR", servers)
        .output()
        .map_err(|e| format!("Could not start MCP runtime: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr)
            .trim()
            .to_string()
            .if_empty("MCP operation failed"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
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
pub fn mcp_install_package(app: tauri::AppHandle, package_id: String) -> Result<String, String> {
    run(&app, &["install", &package_id])
}

#[tauri::command]
pub fn mcp_list_installed(app: tauri::AppHandle) -> Result<Value, String> {
    let output = run(&app, &["list", "--json"])?;
    serde_json::from_str(&output).map_err(|e| format!("Invalid MCP runtime response: {e}"))
}

#[tauri::command]
pub fn mcp_list_tools(app: tauri::AppHandle) -> Result<Value, String> {
    let output = run(&app, &["tools", "--json"])?;
    serde_json::from_str(&output).map_err(|e| format!("Invalid MCP tool response: {e}"))
}

#[tauri::command]
pub fn mcp_call_tool(
    app: tauri::AppHandle,
    server_id: String,
    tool_name: String,
    arguments: Value,
) -> Result<String, String> {
    let args = serde_json::to_string(&arguments).map_err(|e| e.to_string())?;
    run(&app, &["call", &server_id, &tool_name, &args])
}
