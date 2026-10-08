#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wakeword;
mod ytmusic;
mod stt;
mod system_monitor;
mod tts;
mod automation;
mod browser_mcp;

pub fn get_python_cmd() -> String {
    // 1. Check ~/.pihu-os/venv (installed app)
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/mayankjha".to_string());
    let installed_venv = format!("{home}/.pihu-os/venv/bin/python");
    if std::path::Path::new(&installed_venv).exists() {
        return installed_venv;
    }

    // 2. Check development paths
    let relative_paths = [
        "python/venv/bin/python",
        "python/venv/Scripts/python.exe",
        "src-tauri/python/venv/bin/python",
        "src-tauri/python/venv/Scripts/python.exe",
    ];

    for path in &relative_paths {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }

    "python3".to_string()
}

/// Run first-launch setup if ~/.pihu-os/.setup_complete doesn't exist
fn run_first_launch_setup() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/mayankjha".to_string());
    let lock_file = format!("{home}/.pihu-os/.setup_complete");

    if std::path::Path::new(&lock_file).exists() {
        println!("[PIHU] Setup already complete, skipping first-launch.");
        return;
    }

    println!("[PIHU] First launch detected — running auto-setup...");

    // Find the setup script (bundled resource or source tree)
    let candidates = [
        // Inside bundled .app (macOS)
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("../Resources/pihu-first-launch.sh")))
            .unwrap_or_default(),
        // Development source tree
        std::path::PathBuf::from("pihu-first-launch.sh"),
        std::path::PathBuf::from("src-tauri/pihu-first-launch.sh"),
    ];

    for script in &candidates {
        if script.exists() {
            println!("[PIHU] Running setup script: {:?}", script);
            match std::process::Command::new("bash")
                .arg(script)
                .stdout(std::process::Stdio::inherit())
                .stderr(std::process::Stdio::inherit())
                .status()
            {
                Ok(status) if status.success() => {
                    println!("[PIHU] ✅ First-launch setup completed successfully.");
                    return;
                }
                Ok(status) => {
                    eprintln!("[PIHU] ⚠ Setup script exited with: {}", status);
                    return;
                }
                Err(e) => {
                    eprintln!("[PIHU] ⚠ Failed to run setup script: {}", e);
                }
            }
        }
    }

    eprintln!("[PIHU] ⚠ Could not find pihu-first-launch.sh — skipping auto-setup.");
}

fn main() {
    tauri::Builder::default()
        .manage(browser_mcp::BrowserMcpState::default())
        .manage(wakeword::WakewordState {
            stdin: std::sync::Mutex::new(None),
        })
        .manage(stt::STTState {
            stdin: std::sync::Mutex::new(None),
        })
        .manage(system_monitor::SystemMonitorState::new())
        .invoke_handler(tauri::generate_handler![
            wakeword::trigger_listening,
            wakeword::speech_done,
            wakeword::resume_wakeword,
            system_monitor::get_system_info,
            system_monitor::execute_shell_command,
            system_monitor::read_contacts,
            system_monitor::write_contacts,
            automation::macos_app_action,
            automation::macos_ui_action,
            browser_mcp::browser_mcp_action,
            automation::macos_frontmost_app,
            automation::macos_browser_navigate,
            automation::macos_list_apps
        ])
        .setup(|app| {
            // Auto-setup on first launch (installs Python venv, models, credentials)
            run_first_launch_setup();

            let app_handle = app.handle().clone();
            wakeword::start_wakeword_engine(app_handle.clone());
            ytmusic::start_ytmusic_engine();
            stt::start_stt_server(app_handle);
            tts::start_tts_server();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
