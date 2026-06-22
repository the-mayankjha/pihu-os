import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SystemStats {
  cpu_usage: number;
  cpu_cores: number[];
  mem_used: number;
  mem_total: number;
  swap_used: number;
  swap_total: number;
  net_rx: number;
  net_tx: number;
  disk_used: number;
  disk_total: number;
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
  
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  return {
    stats,
    history,
    cpuPercent,
    memPercent,
    formatBytes,
    formatSpeed,
  };
};
