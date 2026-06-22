import { useState, useEffect } from 'react';
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

const MAX_HISTORY = 30; // Keep last 30 data points

let globalStats: SystemStats | null = null;
let globalHistory: SystemStats[] = [];
let listeners: Set<(stats: SystemStats | null, history: SystemStats[]) => void> = new Set();
let isPolling = false;

export const getGlobalSystemStats = () => globalStats;

const startGlobalPolling = () => {
  if (isPolling) return;
  isPolling = true;

  const fetchStats = async () => {
    try {
      const data = await invoke<SystemStats>('get_system_info');
      globalStats = data;
      globalHistory = [...globalHistory, data];
      if (globalHistory.length > MAX_HISTORY) {
        globalHistory = globalHistory.slice(globalHistory.length - MAX_HISTORY);
      }
      listeners.forEach(listener => listener(globalStats, globalHistory));
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  fetchStats();
  // We use a global 1.5 second tick rate so all widgets update perfectly in sync
  setInterval(fetchStats, 1500);
};

export const useSystemMonitor = (_intervalMs?: number) => {
  const [stats, setStats] = useState<SystemStats | null>(globalStats);
  const [history, setHistory] = useState<SystemStats[]>(globalHistory);

  useEffect(() => {
    startGlobalPolling();
    
    const listener = (newStats: SystemStats | null, newHistory: SystemStats[]) => {
      setStats(newStats);
      setHistory(newHistory);
    };
    
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Derived values for easy consumption
  const cpuPercent = stats ? stats.cpu_usage : 0;
  const memPercent = stats ? (stats.mem_used / stats.mem_total) * 100 : 0;
  const diskPercent = stats && stats.disk_total > 0 ? (stats.disk_used / stats.disk_total) * 100 : 0;
  const batteryPercent = stats?.battery?.percentage ?? 0;

  // Normalize speeds to per-second (since we poll every 1.5s)
  const TIME_FACTOR = 1.5;
  const normalizedStats = stats ? {
    ...stats,
    net_rx: stats.net_rx / TIME_FACTOR,
    net_tx: stats.net_tx / TIME_FACTOR,
    disk_read: stats.disk_read / TIME_FACTOR,
    disk_write: stats.disk_write / TIME_FACTOR,
  } : null;

  const normalizedHistory = history.map(h => ({
    ...h,
    net_rx: h.net_rx / TIME_FACTOR,
    net_tx: h.net_tx / TIME_FACTOR,
    disk_read: h.disk_read / TIME_FACTOR,
    disk_write: h.disk_write / TIME_FACTOR,
  }));
  
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
    stats: normalizedStats,
    history: normalizedHistory,
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
