#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod wakeword;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            wakeword::start_wakeword_engine(app_handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
