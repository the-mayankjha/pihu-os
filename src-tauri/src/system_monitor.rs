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
    for disk in disks.list() {
        disk_total += disk.total_space();
        disk_used += disk.total_space() - disk.available_space();
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
                    _ => "Unknown",
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
