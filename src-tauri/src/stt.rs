use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

pub fn start_stt_server() {
    println!("Starting STT WebSocket Server...");
    
    // Spawn the Python process
    let mut child = match Command::new("python3")
        .arg("python/stt_server.py")
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
