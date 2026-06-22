#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wakeword;
mod ytmusic;
mod stt;

fn main() {
    tauri::Builder::default()
        .manage(wakeword::WakewordState {
            stdin: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![wakeword::trigger_listening])
        .setup(|app| {
            let app_handle = app.handle().clone();
            wakeword::start_wakeword_engine(app_handle);
            ytmusic::start_ytmusic_engine();
            stt::start_stt_server();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
