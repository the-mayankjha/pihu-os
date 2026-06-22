use sysinfo::{System, Networks, Disks, CpuRefreshKind, RefreshKind, MemoryRefreshKind};
use std::sync::Mutex;
use tauri::State;
use serde::Serialize;

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: f32, // overall CPU usage
    pub cpu_cores: Vec<f32>, // usage per core
    pub mem_used: u64,
    pub mem_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub net_rx: u64,
    pub net_tx: u64,
    pub disk_used: u64,
    pub disk_total: u64,
}

pub struct SystemMonitorState {
    pub sys: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub disks: Mutex<Disks>,
}

impl SystemMonitorState {
    pub fn new() -> Self {
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        sys.refresh_all();
        
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh();
        
        let mut disks = Disks::new_with_refreshed_list();
        disks.refresh();

        Self {
            sys: Mutex::new(sys),
            networks: Mutex::new(networks),
            disks: Mutex::new(disks),
        }
    }
}

#[tauri::command]
pub fn get_system_info(state: State<'_, SystemMonitorState>) -> SystemStats {
    let mut sys = state.sys.lock().unwrap();
    let mut networks = state.networks.lock().unwrap();
    let mut disks = state.disks.lock().unwrap();

    // Refresh data
    sys.refresh_cpu_usage();
    sys.refresh_memory();
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

    // Network Stats
    let mut net_rx = 0;
    let mut net_tx = 0;
    for (_, network) in networks.iter() {
        net_rx += network.received();
        net_tx += network.transmitted();
    }

    // Disk Stats (calculate total across all disks)
    let mut disk_used = 0;
    let mut disk_total = 0;
    for disk in disks.list() {
        disk_total += disk.total_space();
        disk_used += disk.total_space() - disk.available_space();
    }

    SystemStats {
        cpu_usage,
        cpu_cores,
        mem_used: sys.used_memory(),
        mem_total: sys.total_memory(),
        swap_used: sys.used_swap(),
        swap_total: sys.total_swap(),
        net_rx,
        net_tx,
        disk_used,
        disk_total,
    }
}
