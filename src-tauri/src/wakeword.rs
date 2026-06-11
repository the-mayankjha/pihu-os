use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Serialize, Clone)]
struct WakeWordPayload {
    model: String,
}

pub fn start_wakeword_engine(app: AppHandle) {
    println!("Starting Wakeword Engine...");
    
    // Spawn the Python process
    let mut child = match Command::new("python3")
        .arg("python/wakeword.py")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() 
    {
        Ok(child) => child,
        Err(e) => {
            eprintln!("Failed to start python wakeword engine: {}", e);
            return;
        }
    };

    let stdout = child.stdout.take().expect("Failed to capture python stdout");
    let stderr = child.stderr.take().expect("Failed to capture python stderr");

    // Thread to read stdout
    let app_clone = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if line.starts_with("WAKEWORD_DETECTED:") {
                    let parts: Vec<&str> = line.split(":").collect();
                    if parts.len() >= 2 {
                        let model_name = parts[1].trim().to_string();
                        println!("WAKEWORD TRIGGERED: {}", model_name);
                        
                        let payload = WakeWordPayload { model: model_name };
                        if let Err(e) = app_clone.emit("wake-word-detected", payload) {
                            eprintln!("Failed to emit wake-word-detected event: {}", e);
                        }
                    }
                } else if line == "SPEECH_ENDED" {
                    println!("SPEECH ENDED");
                    if let Err(e) = app_clone.emit("speech-ended", ()) {
                        eprintln!("Failed to emit speech-ended event: {}", e);
                    }
                } else {
                    println!("[WakeWord Stdout] {}", line);
                }
            }
        }
    });

    // Thread to read stderr
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[WakeWord Stderr] {}", line);
            }
        }
    });
}
