#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wakeword;
mod ytmusic;
mod stt;
mod system_monitor;
mod tts;

fn main() {
    tauri::Builder::default()
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
            system_monitor::get_system_info
        ])
        .setup(|app| {
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
