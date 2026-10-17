use std::process::Stdio;
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::Manager;

pub fn start_ytmusic_engine(app: tauri::AppHandle) {
    println!("Starting YTMusic Engine...");
    
    let python_cmd = crate::get_python_cmd();
    println!("YTMusic Engine using python binary: {}", python_cmd);

    let resource_dir = match app.path().resource_dir() {
        Ok(path) => path,
        Err(error) => { eprintln!("Could not locate app resources for YTMusic: {error}"); return; }
    };

    // Spawn the Python process for YTMusic API Server
    let mut child = match crate::background_process::command(&python_cmd)
        .arg(resource_dir.join("python/ytmusic_server.py"))
        .current_dir(&resource_dir)
        .env("PIHU_RESOURCE_DIR", &resource_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() 
    {
        Ok(child) => child,
        Err(e) => {
            eprintln!("Failed to start python ytmusic engine: {}", e);
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
                println!("[YTMusic Stdout] {}", line);
            }
        }
    });

    // Thread to read stderr
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                eprintln!("[YTMusic Stderr] {}", line);
            }
        }
    });
}
