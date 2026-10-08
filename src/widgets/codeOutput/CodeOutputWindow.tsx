import React, { useState } from 'react';
import { PluginWindow } from '../../core/windows/components/PluginWindow';
import { useCodeOutputStore } from '../../stores/codeOutputStore';
import { 
  RotateCcw, Copy, Check, Terminal, 
  Clock, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { executeTool } from '../../core/voice/intent/tools';

export const CodeOutputWindow: React.FC = () => {
  const { isOpen, setIsOpen, activeExecution, isRunning, setIsRunning } = useCodeOutputStore();
  const [copied, setCopied] = useState(false);

  if (!isOpen && !activeExecution) return null;

  const handleCopy = async () => {
    if (!activeExecution) return;
    const textToCopy = `${activeExecution.stdout}\n${activeExecution.stderr}`.trim();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy output:', err);
    }
  };

  const handleReRun = async () => {
    if (!activeExecution || isRunning) return;
    setIsRunning(true);
    try {
      const toolRes = await executeTool('project_mcp_run_code', {
        file_path: activeExecution.fileName || '',
        project_dir: activeExecution.cwd || '',
        language: activeExecution.language || ''
      });
      if (toolRes.success && toolRes.data) {
        // Updated in store by tool
      }
    } catch (err) {
      console.error('Failed to rerun:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const isSuccess = (activeExecution?.exitCode ?? 0) === 0;
  const stdoutLines = (activeExecution?.stdout || '').split('\n');
  const stderrLines = (activeExecution?.stderr || '').split('\n').filter(Boolean);

  return (
    <PluginWindow
      id="code-output-window"
      title={activeExecution?.fileName ? `Output — ${activeExecution.fileName}` : 'PIHU Code Output Console'}
      icon="Terminal"
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      defaultSize={{ width: 840, height: 560 }}
      minWidth={600}
      minHeight={400}
      borderless
      frostui
    >
      <div className="flex flex-col h-full w-full bg-neutral-900/30 backdrop-blur-3xl backdrop-saturate-0 text-neutral-100 font-sans overflow-hidden select-text">
        {/* Global Window Drag Handle & Action Toolbar */}
        <div className="plugin-drag-handle flex items-center justify-between px-4 py-3 bg-white/[0.06] backdrop-blur-xl border-b border-white/10 shrink-0 select-none cursor-grab active:cursor-grabbing">
          {/* File Name & Language Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-500/15 border border-neutral-500/30 text-neutral-300 font-mono text-xs font-semibold">
              <Terminal className="w-3.5 h-3.5 text-neutral-400" />
              <span>{activeExecution?.language ? activeExecution.language.toUpperCase() : 'PROGRAM'}</span>
            </div>

            {activeExecution?.fileName && (
              <span className="font-mono text-xs text-white/90 font-medium truncate max-w-[260px]">
                {activeExecution.fileName}
              </span>
            )}

            {/* Execution Status Badge */}
            {activeExecution && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                  isSuccess
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-neutral-500/15 border-neutral-500/30 text-neutral-300'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-neutral-400" />
                )}
                <span>{isSuccess ? 'Exit: 0 (Success)' : `Exit: ${activeExecution.exitCode} (Failed)`}</span>
              </span>
            )}

            {activeExecution?.durationMs !== undefined && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                <Clock className="w-3 h-3 text-neutral-500" />
                <span>{activeExecution.durationMs}ms</span>
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReRun}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-600 hover:bg-neutral-500 disabled:opacity-50 text-white text-xs font-medium shadow-md transition cursor-pointer"
              title="Re-run program"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Running...' : 'Run Again'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 text-xs font-medium transition cursor-pointer"
              title="Copy output to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-[11px] font-mono">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Command Runner Banner */}
        {activeExecution?.command && (
          <div className="px-4 py-2 bg-black/[0.10] backdrop-blur-xl border-b border-white/5 text-xs font-mono text-neutral-400 flex items-center justify-between select-none">
            <div className="flex items-center gap-2 truncate">
              <span className="text-neutral-400">$</span>
              <span className="text-neutral-300">{activeExecution.command}</span>
            </div>
            {activeExecution.cwd && (
              <span className="text-neutral-400 text-[11px] truncate max-w-[280px] hidden md:inline">
                cwd: {activeExecution.cwd}
              </span>
            )}
          </div>
        )}

        {/* Console Terminal Viewport */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-neutral-900/30 backdrop-blur-3xl backdrop-saturate-0 scrollbar-thin scrollbar-thumb-white/20">
          {!activeExecution || (!activeExecution.stdout && !activeExecution.stderr) ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500">
              <Terminal className="w-10 h-10 mb-3 text-neutral-600" />
              <p>Program executed with no standard output.</p>
            </div>
          ) : (
            <div className="space-y-0.5 min-w-full table border-collapse">
              {/* Stdout Output */}
              {stdoutLines.map((line, idx) => (
                <div key={`out-${idx}`} className="table-row hover:bg-white/[0.02]">
                  <div className="table-cell pr-4 text-right text-neutral-600 select-none w-10 border-r border-white/5 py-0.5">
                    {idx + 1}
                  </div>
                  <div className="table-cell pl-4 text-neutral-200 whitespace-pre py-0.5">
                    {line}
                  </div>
                </div>
              ))}

              {/* Stderr Output */}
              {stderrLines.map((line, idx) => (
                <div key={`err-${idx}`} className="table-row bg-black/15/30 hover:bg-black/15/50">
                  <div className="table-cell pr-4 text-right text-neutral-500/60 select-none w-10 border-r border-neutral-500/20 py-0.5">
                    !
                  </div>
                  <div className="table-cell pl-4 text-neutral-300 whitespace-pre py-0.5 font-medium">
                    {line}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div className="px-4 py-2 bg-white/[0.06] backdrop-blur-xl border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-neutral-400 select-none">
          <div className="flex items-center gap-3">
            <span>Lines: {stdoutLines.length + stderrLines.length}</span>
            <span>•</span>
            <span>Timestamp: {new Date(activeExecution?.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-300">
            <span>PIHU OS Execution Engine</span>
          </div>
        </div>
      </div>
    </PluginWindow>
  );
};
