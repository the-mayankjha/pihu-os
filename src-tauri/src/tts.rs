use std::process::{Command, Child};
use std::thread;
use std::time::Duration;

pub struct TtsServer {
    process: Option<Child>,
}

impl TtsServer {
    pub fn new() -> Self {
        TtsServer { process: None }
    }

    pub fn start(&mut self) -> Result<(), String> {
        println!("Starting TTS Server...");
        
        let mut command = Command::new("python3");
        command.arg("python/tts_server.py");

        match command.spawn() {
            Ok(child) => {
                self.process = Some(child);
                println!("TTS Server started successfully");
                Ok(())
            }
            Err(e) => Err(format!("Failed to start TTS server: {}", e)),
        }
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.process.take() {
            println!("Stopping TTS Server...");
            let _ = child.kill();
            let _ = child.wait();
            println!("TTS Server stopped");
        }
    }
}

pub fn start_tts_server() {
    thread::spawn(move || {
        let mut server = TtsServer::new();
        if let Err(e) = server.start() {
            eprintln!("TTS Server error: {}", e);
        }

        // Keep thread alive to manage the process
        loop {
            thread::sleep(Duration::from_secs(1));
            // In a real app, you might want to add a channel to receive stop signals
        }
    });
}
