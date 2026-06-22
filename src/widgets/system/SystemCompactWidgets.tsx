import React from 'react';
import { useSystemMonitor } from './useSystemMonitor';
import { MiniAreaChart } from './components/MiniAreaChart';
import { ProgressBar } from './components/ProgressBar';
import { CircularProgress } from './components/CircularProgress';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';

// Common base for the compact widgets using GlassCard
const CompactCard: React.FC<{ children: React.ReactNode, preview?: boolean, onClick?: () => void, widgetId: string }> = ({ children, preview, onClick, widgetId }) => {
  const innerContent = (
    <GlassCard 
      onClick={preview ? onClick : undefined}
      blur="lg"
      frost="medium"
      glow={false}
      className={`w-full h-full flex flex-col p-3.5
      ${preview ? 'cursor-pointer hover:scale-[1.02] transition-transform origin-top-left' : ''}`}
    >
      {children}
    </GlassCard>
  );

  if (preview) {
    return (
      <div className="w-[200px] h-[190px] rounded-[20px] overflow-hidden shadow-lg">
         <div style={{ transform: 'scale(1)', transformOrigin: 'top left', width: '200px', height: '190px' }}>
           {innerContent}
         </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id={widgetId}
      defaultPosition={{ x: 200, y: 200 }} 
      defaultSize={{ width: 200, height: 190 }}
      isDraggable={true}
      isResizable={false}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

// SVGs
const CpuIcon = ({ className }: { className?: string }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>;
const MemIcon = ({ className }: { className?: string }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10v4M10 10v4M14 10v4M18 10v4"/></svg>;
const DiskIcon = ({ className }: { className?: string }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>;
const NetIcon = ({ className }: { className?: string }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>;
const BatIcon = ({ className }: { className?: string }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="16" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>;

export const SystemCompactCpuWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, cpuPercent, history } = useSystemMonitor(1000);
  const cpuHistory = history.map(h => h.cpu_usage);

  return (
    <CompactCard preview={preview} onClick={onClick} widgetId="system-compact-cpu">
      <div className="flex items-center gap-2 mb-3">
        <CpuIcon className="text-pink-500" />
        <span className="text-xs font-bold text-white/80 tracking-widest">CPU</span>
      </div>
      
      <div className="flex gap-4 items-center mb-auto">
        <div className="relative">
          <CircularProgress 
            progress={cpuPercent} 
            size={68} 
            strokeWidth={6} 
            colorClass="text-pink-500"
            glowClass="drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]"
          >
            <div className="flex flex-col items-center justify-center -mt-0.5">
              <span className="text-lg font-bold text-white tracking-tight">
                {cpuPercent.toFixed(0)}<span className="text-[10px]">%</span>
              </span>
            </div>
          </CircularProgress>
        </div>
        
        <div className="flex flex-col gap-2 flex-1">
          <div>
            <div className="text-[14px] font-bold text-white leading-none">{stats ? (stats.cpu_frequency / 1000).toFixed(2) : '0.00'} GHz</div>
            <div className="text-[9px] text-white/50 tracking-wide mt-1">Speed</div>
          </div>
          <div>
            <div className="text-[14px] font-bold text-white leading-none">{stats ? stats.cpu_cores.length : 0} Cores</div>
            <div className="text-[9px] text-white/50 tracking-wide mt-1">{stats ? stats.cpu_thread_count : 0} Threads</div>
          </div>
        </div>
      </div>
      
      <div>
        <div className="h-6 w-full -mb-1">
          <MiniAreaChart data={cpuHistory} colorClass="text-pink-500" />
        </div>
        <div className="text-[9px] text-white/40 font-medium truncate">
          {stats ? stats.cpu_model : 'Processor'}
        </div>
      </div>
    </CompactCard>
  );
};

export const SystemCompactMemWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, memPercent, formatBytes } = useSystemMonitor(1000);

  return (
    <CompactCard preview={preview} onClick={onClick} widgetId="system-compact-mem">
      <div className="flex items-center gap-2 mb-3">
        <MemIcon className="text-purple-400" />
        <span className="text-xs font-bold text-white/80 tracking-widest">MEMORY</span>
      </div>
      
      <div className="flex gap-4 items-center mb-auto">
        <div className="relative">
          <CircularProgress 
            progress={memPercent} 
            size={68} 
            strokeWidth={6} 
            colorClass="text-purple-400"
            glowClass="drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]"
          >
            <div className="flex flex-col items-center justify-center -mt-0.5">
               <span className="text-lg font-bold text-white tracking-tight">
                 {memPercent.toFixed(0)}<span className="text-[10px]">%</span>
               </span>
            </div>
          </CircularProgress>
        </div>
        
        <div className="flex flex-col gap-2 flex-1">
          <div>
            <div className="text-[14px] font-bold text-white leading-none">{stats ? formatBytes(stats.mem_used, 1) : '0 GB'}</div>
            <div className="text-[9px] text-white/50 tracking-wide mt-1">Used</div>
          </div>
          <div>
            <div className="text-[14px] font-bold text-white leading-none">{stats ? formatBytes(stats.mem_total, 1) : '0 GB'}</div>
            <div className="text-[9px] text-white/50 tracking-wide mt-1">Total</div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-1.5">
        <div>
          <div className="flex justify-between items-center text-[9px] font-medium text-white/50 tracking-wide mb-1">
            <span>RAM</span>
            <span>{stats ? `${formatBytes(stats.mem_used, 1)} / ${formatBytes(stats.mem_total, 1)}` : '0 / 0 GB'}</span>
          </div>
          <ProgressBar progress={memPercent} colorClass="bg-purple-400" height="h-1.5" bgClass="bg-white/10" />
        </div>
        <div>
          <div className="flex justify-between items-center text-[9px] font-medium text-white/50 tracking-wide mb-1">
            <span>Swap</span>
            <span>{stats ? `${formatBytes(stats.swap_used, 1)} / ${formatBytes(stats.swap_total, 1)}` : '0 / 0 GB'}</span>
          </div>
          <ProgressBar progress={stats ? (stats.swap_used / stats.swap_total) * 100 : 0} colorClass="bg-purple-600" height="h-1.5" bgClass="bg-white/10" />
        </div>
      </div>
    </CompactCard>
  );
};

export const SystemCompactDiskWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, diskPercent, formatBytes, history } = useSystemMonitor(2000);
  const readHistory = history.map(h => h.disk_read);
  const writeHistory = history.map(h => h.disk_write);

  return (
    <CompactCard preview={preview} onClick={onClick} widgetId="system-compact-disk">
      <div className="flex items-center gap-2 mb-3">
        <DiskIcon className="text-yellow-500" />
        <span className="text-xs font-bold text-white/80 tracking-widest">DISK</span>
      </div>
      
      <div className="flex gap-4 items-center mb-auto">
        <div className="relative">
          <CircularProgress 
            progress={diskPercent} 
            size={68} 
            strokeWidth={6} 
            colorClass="text-yellow-500"
            glowClass="drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]"
          >
            <div className="flex flex-col items-center justify-center -mt-0.5">
               <span className="text-lg font-bold text-white tracking-tight">
                 {diskPercent.toFixed(0)}<span className="text-[10px]">%</span>
               </span>
            </div>
          </CircularProgress>
        </div>
        
        <div className="flex flex-col gap-2 flex-1">
          <div>
            <div className="text-[14px] font-bold text-white leading-none">{stats ? formatBytes(stats.disk_used, 0) : '0 GB'}</div>
            <div className="text-[9px] text-white/50 tracking-wide mt-1">Used</div>
          </div>
          <div>
            <div className="text-[14px] font-bold text-white leading-none">{stats ? formatBytes(stats.disk_total, 0) : '0 GB'}</div>
            <div className="text-[9px] text-white/50 tracking-wide mt-1">Total</div>
          </div>
        </div>
      </div>
      
      <div>
        <div className="text-[9px] text-white/60 font-medium tracking-wide mb-1 truncate">NVMe SSD</div>
        <div className="flex justify-between gap-3">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] text-white/40">Read</span>
              <span className="text-[10px] font-bold text-white">{stats ? formatBytes(stats.disk_read, 0) + '/s' : '0 B/s'}</span>
            </div>
            <div className="h-6 w-full"><MiniAreaChart data={readHistory} colorClass="text-yellow-500" /></div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] text-white/40">Write</span>
              <span className="text-[10px] font-bold text-white">{stats ? formatBytes(stats.disk_write, 0) + '/s' : '0 B/s'}</span>
            </div>
            <div className="h-6 w-full"><MiniAreaChart data={writeHistory} colorClass="text-orange-500" /></div>
          </div>
        </div>
      </div>
    </CompactCard>
  );
};

export const SystemCompactNetWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, formatNetworkSpeed, history } = useSystemMonitor(1000);
  const rxHistory = history.map(h => h.net_rx);
  const txHistory = history.map(h => h.net_tx);

  const formatSpeedValues = (bytes: number) => {
    const formatted = formatNetworkSpeed(bytes);
    const [val, unit] = formatted.split(' ');
    return { val, unit };
  };

  const down = formatSpeedValues(stats?.net_rx ?? 0);
  const up = formatSpeedValues(stats?.net_tx ?? 0);

  return (
    <CompactCard preview={preview} onClick={onClick} widgetId="system-compact-net">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <NetIcon className="text-white/60" />
          <span className="text-xs font-bold text-white/80 tracking-widest">NETWORK</span>
        </div>
        <div className="text-[9px] font-medium text-white/60 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/5">
          Wi-Fi <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      
      <div className="flex gap-3 mb-auto">
        <div className="flex-1">
          <div className="text-[9px] text-white/50 tracking-wide mb-1.5">Download</div>
          <div className="flex items-end gap-1 mb-2">
            <svg className="text-sky-400 mb-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            <span className="text-xl font-bold text-white tracking-tight leading-none">{down.val}</span>
            <span className="text-[9px] text-white/50 mb-0.5">{down.unit}</span>
          </div>
          <div className="h-6 w-full">
            <MiniAreaChart data={rxHistory} colorClass="text-sky-400" />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="text-[9px] text-white/50 tracking-wide mb-1.5">Upload</div>
          <div className="flex items-end gap-1 mb-2">
            <svg className="text-pink-500 mb-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            <span className="text-xl font-bold text-white tracking-tight leading-none">{up.val}</span>
            <span className="text-[9px] text-white/50 mb-0.5">{up.unit}</span>
          </div>
          <div className="h-6 w-full">
            <MiniAreaChart data={txHistory} colorClass="text-pink-500" />
          </div>
        </div>
      </div>
      
      <div className="pt-2 flex justify-between items-center border-t border-white/5">
        <div className="text-[9px] text-white/50 tracking-wide">Total</div>
        <div className="flex gap-3">
           <div className="flex items-center gap-1.5">
             <svg className="text-sky-400" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
             <span className="text-[10px] font-bold text-white">-- GB</span>
           </div>
           <div className="flex items-center gap-1.5">
             <svg className="text-pink-500" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
             <span className="text-[10px] font-bold text-white">-- GB</span>
           </div>
        </div>
      </div>
    </CompactCard>
  );
};

export const SystemCompactBatWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, batteryPercent, formatUptime } = useSystemMonitor(5000);
  const battery = stats?.battery;

  let rawState = battery?.state ?? 'Unknown';
  if (rawState === 'Unknown') {
    rawState = batteryPercent >= 99 ? 'Full' : 'Plugged In';
  }

  const isCharging = rawState === 'Charging' || rawState === 'Plugged In';
  const stateColor = isCharging ? 'text-yellow-400' : 
                     rawState === 'Full' ? 'text-emerald-400' : 'text-orange-400';
  const displayState = rawState === 'Discharging' ? 'On Battery' : rawState;

  const batteryColorClass = batteryPercent > 20 ? "bg-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]";

  return (
    <CompactCard preview={preview} onClick={onClick} widgetId="system-compact-bat">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BatIcon className="text-emerald-400" />
          <span className="text-xs font-bold text-white/80 tracking-widest">BATTERY</span>
        </div>
        <div className="text-xl font-light text-white tracking-tighter leading-none flex items-baseline">
          {batteryPercent.toFixed(0)}<span className="text-[10px] text-white/50 ml-[1px]">%</span>
        </div>
      </div>
      
      <div className="flex justify-center mb-auto">
        <div className="relative w-28 h-10 rounded-md border-[2px] border-white/20 p-1 flex items-center">
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-white/20 rounded-r-[2px]" />
          <div 
            className={`h-full rounded-sm transition-all ${batteryColorClass}`}
            style={{ width: `${batteryPercent}%` }}
          />
          {isCharging && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/50 drop-shadow-sm"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-2 px-2 pb-1">
        <div className="flex flex-col">
           <span className="text-[9px] text-white/40 tracking-wider font-semibold">STATUS</span>
           <span className={`text-[10px] font-bold ${stateColor} truncate`}>{displayState}</span>
        </div>
        <div className="flex flex-col">
           <span className="text-[9px] text-white/40 tracking-wider font-semibold">TIME LEFT</span>
           <span className="text-[10px] font-bold text-white truncate">{battery?.time_left_secs && battery.time_left_secs < 360000 ? formatUptime(battery.time_left_secs) : '---'}</span>
        </div>
        <div className="flex flex-col">
           <span className="text-[9px] text-white/40 tracking-wider font-semibold">HEALTH</span>
           <span className="text-[10px] font-bold text-white truncate">{battery?.health ? battery.health.toFixed(0) : 100}%</span>
        </div>
        <div className="flex flex-col">
           <span className="text-[9px] text-white/40 tracking-wider font-semibold">CYCLES</span>
           <span className="text-[10px] font-bold text-white truncate">{battery?.cycle_count ?? 0}</span>
        </div>
      </div>
    </CompactCard>
  );
};
