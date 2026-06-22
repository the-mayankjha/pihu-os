import React from 'react';
import { useSystemMonitor } from './useSystemMonitor';
import { MiniAreaChart } from './components/MiniAreaChart';

import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';

const LargeCard: React.FC<{ children: React.ReactNode, preview?: boolean, onClick?: () => void, widgetId: string }> = ({ children, preview, onClick, widgetId }) => {
  const innerContent = (
    <GlassCard 
      onClick={preview ? onClick : undefined}
      blur="lg"
      frost="medium"
      glow={false}
      className={`w-full h-full flex flex-col p-5
      ${preview ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
    >
      {children}
    </GlassCard>
  );

  if (preview) {
    return (
      <div className="w-[288px] h-[192px]">
        {innerContent}
      </div>
    );
  }

  return (
    <WidgetContainer 
      id={widgetId}
      defaultPosition={{ x: 600, y: 200 }} 
      defaultSize={{ width: 288, height: 192 }}
      isDraggable={true}
      isResizable={false}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};

// SVGs
const CpuIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>;
const MemIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10v4M10 10v4M14 10v4M18 10v4"/></svg>;
const ListIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const InfoIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const ActivityIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const TimerIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/></svg>;
const HardDriveIcon = ({ className = "" }) => <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>;

export const SystemResourceMonitorWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, history, cpuPercent, memPercent } = useSystemMonitor(1000);
  const cpuHistory = history.map(h => h.cpu_usage);
  const memHistory = history.map(h => (h.mem_used / h.mem_total) * 100);

  return (
    <LargeCard preview={preview} onClick={onClick} widgetId="system-large-resource">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <ActivityIcon className="text-indigo-400" />
          <span className="text-sm font-semibold text-white/80 tracking-widest">PERFORMANCE</span>
        </div>
        {stats && <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{stats.cpu_model.substring(0, 15)}...</span>}
      </div>
      
      <div className="flex-1 flex gap-4">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <CpuIcon className="text-pink-500" />
            <span className="text-xs font-semibold text-white/50 tracking-widest">CPU</span>
          </div>
          <span className="text-3xl font-light text-white tracking-tighter">
            {cpuPercent.toFixed(0)}<span className="text-lg text-white/50">%</span>
          </span>
          <div className="h-10 w-full mt-1">
            <MiniAreaChart data={cpuHistory} colorClass="text-pink-500" />
          </div>
        </div>

        <div className="w-[1px] bg-white/10 my-2" />

        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <MemIcon className="text-purple-400" />
            <span className="text-xs font-semibold text-white/50 tracking-widest">RAM</span>
          </div>
          <span className="text-3xl font-light text-white tracking-tighter">
            {memPercent.toFixed(0)}<span className="text-lg text-white/50">%</span>
          </span>
          <div className="h-10 w-full mt-1">
            <MiniAreaChart data={memHistory} colorClass="text-purple-400" />
          </div>
        </div>
      </div>
    </LargeCard>
  );
};

export const SystemTopProcessesWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, formatBytes } = useSystemMonitor(2000);

  return (
    <LargeCard preview={preview} onClick={onClick} widgetId="system-large-processes">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <ListIcon className="text-emerald-400" />
          <span className="text-sm font-semibold text-white/80 tracking-widest">TOP PROCESSES</span>
        </div>
        <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{stats?.total_processes || 0} TOTAL</span>
      </div>
      
      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        {stats?.top_processes.slice(0, 4).map((proc, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-sky-400/50" />
              <span className="text-xs text-white truncate w-32">{proc.name}</span>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="text-pink-400 font-mono w-8 text-right">{proc.cpu_usage.toFixed(1)}%</span>
              <span className="text-purple-400 font-mono w-12 text-right">{formatBytes(proc.mem_usage)}</span>
            </div>
          </div>
        ))}
      </div>
    </LargeCard>
  );
};

export const SystemDetailedOverviewWidget: React.FC<{ preview?: boolean, onClick?: () => void }> = ({ preview, onClick }) => {
  const { stats, formatUptime } = useSystemMonitor(1000);

  return (
    <LargeCard preview={preview} onClick={onClick} widgetId="system-large-overview">
      <div className="flex items-center gap-2 mb-3">
        <InfoIcon className="text-blue-400" />
        <span className="text-sm font-semibold text-white/80 tracking-widest">SYSTEM DETAILS</span>
      </div>
      
      {stats && (
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CpuIcon className="w-16 h-16 text-pink-400" />
            </div>
            <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
              <CpuIcon className="text-pink-400 w-3 h-3" />
              <span className="text-[9px] text-white/50 tracking-widest font-semibold">CPU THREADS</span>
            </div>
            <span className="text-sm text-white font-medium relative z-10">{stats.cpu_thread_count} Active</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ActivityIcon className="w-16 h-16 text-yellow-400" />
            </div>
            <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
              <ActivityIcon className="text-yellow-400 w-3 h-3" />
              <span className="text-[9px] text-white/50 tracking-widest font-semibold">FREQUENCY</span>
            </div>
            <span className="text-sm text-white font-medium relative z-10">{stats.cpu_frequency} MHz</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <TimerIcon className="w-16 h-16 text-emerald-400" />
            </div>
            <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
              <TimerIcon className="text-emerald-400 w-3 h-3" />
              <span className="text-[9px] text-white/50 tracking-widest font-semibold">UPTIME</span>
            </div>
            <span className="text-sm text-white font-medium relative z-10">{formatUptime(stats.uptime)}</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <HardDriveIcon className="w-16 h-16 text-orange-400" />
            </div>
            <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
              <HardDriveIcon className="text-orange-400 w-3 h-3" />
              <span className="text-[9px] text-white/50 tracking-widest font-semibold">SWAP USAGE</span>
            </div>
            <span className="text-sm text-white font-medium relative z-10">{((stats.swap_used / Math.max(1, stats.swap_total)) * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
    </LargeCard>
  );
};
