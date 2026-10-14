use sysinfo::{System, ProcessExt, SystemExt};

fn main() {
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_secs(1));
    sys.refresh_all();
    
    let mut total_read_bytes = 0;
    let mut total_written_bytes = 0;
    let mut read_bytes = 0;
    let mut written_bytes = 0;

    for (_pid, process) in sys.processes() {
        let usage = process.disk_usage();
        total_read_bytes += usage.total_read_bytes;
        total_written_bytes += usage.total_written_bytes;
        read_bytes += usage.read_bytes;
        written_bytes += usage.written_bytes;
    }
    
    println!("Total Read: {}", total_read_bytes);
    println!("Total Written: {}", total_written_bytes);
    println!("Delta Read: {}", read_bytes);
    println!("Delta Written: {}", written_bytes);
}
