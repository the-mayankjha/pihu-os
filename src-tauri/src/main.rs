#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wakeword;
mod ytmusic;
mod stt;
mod system_monitor;
mod tts;
mod automation;
mod google_oauth;
mod spotify_mcp;
mod browser_mcp;
mod vtop_credentials;
mod spirits;
mod mcp_market;
mod whatsapp_mcp;
mod shortcuts;
mod background_process;
mod account_file;
mod bundled_runtime;
use tauri::Manager;

pub fn get_python_cmd() -> String {
    if let Some(python) = bundled_runtime::python() {
        // Release builds must never silently use the host Python or an old user venv.
        if !cfg!(debug_assertions) || python.is_file() { return python.to_string_lossy().into_owned(); }
    }
    // Resolve project paths absolutely: Tauri's working directory varies.
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let dev = root.join(if cfg!(windows) { "../.pihu-setup/dev-python/Scripts/python.exe" } else { "../.pihu-setup/dev-python/bin/python3" });
    if dev.is_file() { return dev.to_string_lossy().into_owned(); }
    let local = root.join(if cfg!(windows) { "python/venv/Scripts/python.exe" } else { "python/venv/bin/python" });
    if local.is_file() { return local.to_string_lossy().into_owned(); }

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
            match crate::background_process::command("bash")
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
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        shortcuts::dispatch(app, shortcut);
                    }
                })
                .build(),
        );
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());
    builder
        .manage(browser_mcp::BrowserMcpState::default())
        .manage(shortcuts::DynamicShortcutState::default())
        .manage(wakeword::WakewordState {
            stdin: std::sync::Mutex::new(None),
        })
        .manage(stt::STTState {
            stdin: std::sync::Mutex::new(None),
        })
        .manage(system_monitor::SystemMonitorState::new())
        .manage(spotify_mcp::SpotifyMcpState::default())
        .manage(whatsapp_mcp::WhatsAppMcpState::default())
        .invoke_handler(tauri::generate_handler![
            bundled_runtime::diagnose_runtime,
            spirits::sync_spirits,
            spirits::refresh_spirit_windows,
            spirits::sync_voice_overlay,
            spirits::sync_command_palette,
            shortcuts::set_global_shortcut,
            shortcuts::clear_global_shortcut,
            mcp_market::mcp_install_package,
            mcp_market::mcp_manage_package,
            whatsapp_mcp::whatsapp_mcp_start,
            mcp_market::mcp_list_installed,
            mcp_market::mcp_list_tools,
            mcp_market::mcp_call_tool,
            wakeword::trigger_listening,
            wakeword::speech_done,
            wakeword::resume_wakeword,
            system_monitor::get_system_info,
            system_monitor::execute_shell_command,
            system_monitor::read_contacts,
            system_monitor::write_contacts,
            automation::macos_app_action,
            automation::macos_ui_action,
            automation::macos_running_applications,
            google_oauth::google_oauth_start,
            google_oauth::read_google_accounts,
            spotify_mcp::spotify_mcp_action,
            browser_mcp::browser_mcp_action,
            vtop_credentials::vtop_credentials,
            automation::macos_frontmost_app,
            automation::macos_browser_navigate,
            automation::macos_list_apps
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                spirits::release_all(window.app_handle());
                window.app_handle().exit(0);
            }
        })
        .setup(|app| {
            // Release resources are prepared at build time; legacy setup is developer-only.
            let resources = app.path().resource_dir()?;
            bundled_runtime::initialize(resources);
            if cfg!(debug_assertions) { run_first_launch_setup(); }

            let app_handle = app.handle().clone();
            wakeword::start_wakeword_engine(app_handle.clone());
            ytmusic::start_ytmusic_engine(app_handle.clone());
            stt::start_stt_server(app_handle);
            tts::start_tts_server(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
                tts::stop_tts_server();
                let _ = browser_mcp::stop(app);
                let _ = spotify_mcp::stop(app);
                let _ = whatsapp_mcp::stop(app);
            }
        });
}
