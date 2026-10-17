use std::process::{ChildStdin, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct STTState {
    pub stdin: Mutex<Option<ChildStdin>>,
}

pub fn start_stt_server(app: AppHandle) {
    println!("Starting STT WebSocket Server...");
    
    let python_cmd = crate::get_python_cmd();
    println!("STT Server using python binary: {}", python_cmd);

    let resource_dir = match app.path().resource_dir() {
        Ok(path) => path,
        Err(error) => { eprintln!("Could not locate app resources for STT: {error}"); return; }
    };
    let script = resource_dir.join("python/stt_server.py");
    let mut child = match crate::background_process::command(&python_cmd)
        .arg(&script)
        .current_dir(&resource_dir)
        .env("PIHU_RESOURCE_DIR", &resource_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() 
    {
        Ok(child) => child,
        Err(e) => {
            eprintln!("Failed to start python STT server: {}", e);
            return;
        }
    };

    let stdin = child.stdin.take().expect("Failed to capture python stdin");
    let state: tauri::State<STTState> = app.state();
    *state.stdin.lock().unwrap() = Some(stdin);

    let stdout = child.stdout.take().expect("Failed to capture python stdout");
    let stderr = child.stderr.take().expect("Failed to capture python stderr");

    // Thread to read stdout
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                println!("[STT Server] {}", line);
            }
        }
    });

    // Thread to read stderr
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[STT Error] {}", line);
            }
        }
    });
}
