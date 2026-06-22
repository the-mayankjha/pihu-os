import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ProcessInfo {
  name: string;
  cpu_usage: number;
  mem_usage: number;
}

export interface BatteryInfo {
  percentage: number;
  state: string;
  time_left_secs: number | null;
  health: number;
  cycle_count: number | null;
}

export interface SystemStats {
  cpu_usage: number;
  cpu_cores: number[];
  cpu_frequency: number;
  cpu_model: string;
  cpu_thread_count: number;
  mem_used: number;
  mem_total: number;
  swap_used: number;
  swap_total: number;
  net_rx: number;
  net_tx: number;
  disk_used: number;
  disk_total: number;
  disk_read: number;
  disk_write: number;
  uptime: number;
  total_processes: number;
  top_processes: ProcessInfo[];
  battery: BatteryInfo | null;
}

export const useSystemMonitor = (intervalMs: number = 1000) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<SystemStats[]>([]);
  const MAX_HISTORY = 30; // Keep last 30 data points

  const fetchStats = useCallback(async () => {
    try {
      const data = await invoke<SystemStats>('get_system_info');
      setStats(data);
      setHistory((prev) => {
        const newHistory = [...prev, data];
        if (newHistory.length > MAX_HISTORY) {
          return newHistory.slice(newHistory.length - MAX_HISTORY);
        }
        return newHistory;
      });
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Setup polling
    const intervalId = setInterval(fetchStats, intervalMs);

    return () => clearInterval(intervalId);
  }, [fetchStats, intervalMs]);

  // Derived values for easy consumption
  const cpuPercent = stats ? stats.cpu_usage : 0;
  const memPercent = stats ? (stats.mem_used / stats.mem_total) * 100 : 0;
  const diskPercent = stats && stats.disk_total > 0 ? (stats.disk_used / stats.disk_total) * 100 : 0;
  const batteryPercent = stats?.battery?.percentage ?? 0;
  
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatNetworkSpeed = (bytesPerSec: number) => {
    // Convert to bits per second for Network typical display (Mbps)
    const bitsPerSec = bytesPerSec * 8;
    if (bitsPerSec < 1000) return `${bitsPerSec.toFixed(0)} bps`;
    if (bitsPerSec < 1000 * 1000) return `${(bitsPerSec / 1000).toFixed(1)} Kbps`;
    return `${(bitsPerSec / (1000 * 1000)).toFixed(1)} Mbps`;
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return {
    stats,
    history,
    cpuPercent,
    memPercent,
    diskPercent,
    batteryPercent,
    formatBytes,
    formatSpeed,
    formatNetworkSpeed,
    formatUptime,
  };
};
