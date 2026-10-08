use sysinfo::{System, Networks, Disks, CpuRefreshKind, RefreshKind, MemoryRefreshKind, ProcessRefreshKind};
use starship_battery::{Manager as BatteryManager, State as BatteryState};
use std::sync::Mutex;
use tauri::State;
use serde::Serialize;
use std::cmp::Ordering;

#[derive(Serialize, Clone)]
pub struct ProcessInfo {
    pub name: String,
    pub cpu_usage: f32,
    pub mem_usage: u64,
}

#[derive(Serialize, Clone)]
pub struct BatteryInfo {
    pub percentage: f32,
    pub state: String,
    pub time_left_secs: Option<u64>,
    pub health: f32,
    pub cycle_count: Option<u32>,
}

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub cpu_cores: Vec<f32>,
    pub cpu_frequency: u64,
    pub cpu_model: String,
    pub cpu_thread_count: usize,
    pub mem_used: u64,
    pub mem_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub net_rx: u64,
    pub net_tx: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub disk_read: u64,
    pub disk_write: u64,
    pub uptime: u64,
    pub total_processes: usize,
    pub top_processes: Vec<ProcessInfo>,
    pub battery: Option<BatteryInfo>,
}

pub struct SystemMonitorState {
    pub sys: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub disks: Mutex<Disks>,
    pub battery_manager: Mutex<Option<BatteryManager>>,
}

impl SystemMonitorState {
    pub fn new() -> Self {
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything())
                .with_processes(ProcessRefreshKind::everything()),
        );
        sys.refresh_all();
        
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh();
        
        let mut disks = Disks::new_with_refreshed_list();
        disks.refresh();

        let battery_manager = BatteryManager::new().ok();

        Self {
            sys: Mutex::new(sys),
            networks: Mutex::new(networks),
            disks: Mutex::new(disks),
            battery_manager: Mutex::new(battery_manager),
        }
    }
}

#[tauri::command]
pub fn get_system_info(state: State<'_, SystemMonitorState>) -> SystemStats {
    let mut sys = state.sys.lock().unwrap();
    let mut networks = state.networks.lock().unwrap();
    let mut disks = state.disks.lock().unwrap();
    let battery_manager_opt = state.battery_manager.lock().unwrap();

    // Refresh data
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    sys.refresh_processes();
    networks.refresh();
    disks.refresh();

    // CPU Stats
    let cpus = sys.cpus();
    let cpu_cores: Vec<f32> = cpus.iter().map(|cpu| cpu.cpu_usage()).collect();
    let cpu_usage = if !cpu_cores.is_empty() {
        cpu_cores.iter().sum::<f32>() / cpu_cores.len() as f32
    } else {
        0.0
    };
    
    let cpu_frequency = cpus.first().map(|cpu| cpu.frequency()).unwrap_or(0);
    let cpu_model = cpus.first().map(|cpu| cpu.brand().to_string()).unwrap_or_default();
    let cpu_thread_count = cpus.len();

    // Network Stats
    let mut net_rx = 0;
    let mut net_tx = 0;
    for (_, network) in networks.iter() {
        net_rx += network.received();
        net_tx += network.transmitted();
    }

    // Disk Stats
    let mut disk_used = 0;
    let mut disk_total = 0;
    
    // Find the primary disk (usually mounted at "/") to prevent double counting 
    // APFS volumes on macOS (like / and /System/Volumes/Data)
    let primary_disk = disks.list().iter().find(|d| d.mount_point().to_string_lossy() == "/" || d.mount_point().to_string_lossy() == "C:\\");
    
    if let Some(disk) = primary_disk.or_else(|| disks.list().first()) {
        disk_total = disk.total_space();
        disk_used = disk.total_space() - disk.available_space();
    }

    // Process Stats & Disk I/O from processes
    let mut total_disk_read = 0;
    let mut total_disk_write = 0;
    let mut processes: Vec<ProcessInfo> = Vec::new();

    for (_pid, process) in sys.processes() {
        let usage = process.disk_usage();
        total_disk_read += usage.read_bytes;
        total_disk_write += usage.written_bytes;

        processes.push(ProcessInfo {
            name: process.name().to_string(),
            cpu_usage: process.cpu_usage(),
            mem_usage: process.memory(),
        });
    }

    let total_processes = processes.len();

    // Sort by CPU usage and take top 5
    processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(Ordering::Equal));
    processes.truncate(5);

    // Battery Stats
    let mut battery_info = None;
    if let Some(manager) = &*battery_manager_opt {
        if let Ok(mut batteries) = manager.batteries() {
            if let Some(Ok(battery)) = batteries.next() {
                let state_str = match battery.state() {
                    BatteryState::Charging => "Charging",
                    BatteryState::Discharging => "Discharging",
                    BatteryState::Empty => "Empty",
                    BatteryState::Full => "Full",
                    BatteryState::Unknown => "Unknown",
                }.to_string();

                battery_info = Some(BatteryInfo {
                    percentage: battery.state_of_charge().value * 100.0,
                    state: state_str,
                    time_left_secs: battery.time_to_empty().map(|t| t.value as u64).or_else(|| battery.time_to_full().map(|t| t.value as u64)),
                    health: battery.state_of_health().value * 100.0,
                    cycle_count: battery.cycle_count(),
                });
            }
        }
    }

    SystemStats {
        cpu_usage,
        cpu_cores,
        cpu_frequency,
        cpu_model,
        cpu_thread_count,
        mem_used: sys.used_memory(),
        mem_total: sys.total_memory(),
        swap_used: sys.used_swap(),
        swap_total: sys.total_swap(),
        net_rx,
        net_tx,
        disk_used,
        disk_total,
        disk_read: total_disk_read,
        disk_write: total_disk_write,
        uptime: System::uptime(),
        total_processes,
        top_processes: processes,
        battery: battery_info,
    }
}

#[tauri::command]
pub async fn execute_shell_command(command: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || execute_shell_command_blocking(command))
        .await.map_err(|error| error.to_string())?
}

fn execute_shell_command_blocking(command: String) -> Result<String, String> {
    println!("Executing OS command via Tauri: {}", command);
    let output = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(&["/C", &command])
            .output()
    } else {
        std::process::Command::new("sh")
            .arg("-c")
            .arg(&command)
            .output()
    };

    match output {
        Ok(out) => {
            if out.status.success() {
                Ok(String::from_utf8_lossy(&out.stdout).to_string())
            } else {
                Err(String::from_utf8_lossy(&out.stderr).to_string())
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

fn contacts_file_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "Could not determine the home directory".to_string())?;
    Ok(std::path::PathBuf::from(home).join(".pihu").join("contacts.json"))
}

/// Read the one contact directory shared by Desktop, CLI, REPL, and the agent.
#[tauri::command]
pub fn read_contacts() -> Result<String, String> {
    let path = contacts_file_path()?;
    match std::fs::read_to_string(&path) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok("[]".to_string()),
        Err(error) => Err(format!("Could not read {}: {error}", path.display())),
    }
}

/// Persist contacts atomically so a CLI/REPL update cannot leave a partial JSON file.
#[tauri::command]
pub fn write_contacts(contacts_json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&contacts_json)
        .map_err(|error| format!("Contacts must be valid JSON: {error}"))?;
    let path = contacts_file_path()?;
    let parent = path.parent().ok_or_else(|| "Invalid contacts path".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| format!("Could not create contacts directory: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, contacts_json).map_err(|error| format!("Could not write contacts: {error}"))?;
    std::fs::rename(&temporary, &path).map_err(|error| format!("Could not save contacts: {error}"))
}
