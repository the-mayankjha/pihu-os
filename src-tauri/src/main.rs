#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wakeword;
mod ytmusic;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            wakeword::start_wakeword_engine(app_handle);
            ytmusic::start_ytmusic_engine();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
