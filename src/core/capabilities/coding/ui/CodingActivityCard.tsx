import React, { useState } from 'react';
import { 
  FileCode, Terminal, CheckCircle2, AlertCircle, 
  ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { IdeCodeBlock } from '../../../voice/IdeCodeBlock';
import { useLayoutStore } from '../../../layout/LayoutStore';

interface CodingActivityCardProps {
  plan?: any | null;
  fileChange?: any | null;
  report?: any | null;
}

export const CodingActivityCard: React.FC<CodingActivityCardProps> = ({
  plan,
  fileChange,
  report
}) => {
  const [showDiff, setShowDiff] = useState(true);
  const layout = useLayoutStore();

  if (!plan && !fileChange && !report) return null;

  const handleOpenTerminal = () => {
    if (!layout.widgets['code-output-window']?.isOpen) {
      layout.toggleWidget('code-output-window');
    }
  };

  return (
    <div className="flex flex-col gap-3 my-3 w-full max-w-xl text-neutral-100 font-sans text-xs select-text">
      {/* 1. Implementation Plan Card */}
      {plan && (
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-xl p-3 shadow-xl flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-white/95 text-sm">{plan.title}</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              PLAN ACTIVE
            </span>
          </div>

          <p className="text-neutral-300 text-[11px] leading-relaxed">{plan.summary}</p>

          {/* Steps List */}
          <div className="flex flex-col gap-1.5 mt-1">
            {plan.steps?.map((step: any, index: number) => (
              <div 
                key={step.id || index}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/5"
              >
                <div className="mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-white/90">{step.title}</span>
                  {step.description && (
                    <span className="text-[10px] text-neutral-400">{step.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. File Change & Diff Viewer */}
      {fileChange && (
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-xl">
          <div 
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/10 cursor-pointer hover:bg-white/[0.06] transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-mono text-[11px] text-neutral-200 truncate">
                {fileChange.path.split('/').pop()}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {fileChange.action.toUpperCase()}
              </span>
            </div>
            {showDiff ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
          </div>

          {showDiff && (
            <div className="p-2 max-h-64 overflow-y-auto">
              <IdeCodeBlock 
                language="diff" 
                filename={fileChange.path.split('/').pop()}
              >
                {fileChange.diff || fileChange.newContent}
              </IdeCodeBlock>
            </div>
          )}
        </div>
      )}

      {/* 3. Verification & Report Card */}
      {report && (
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-xl p-3 shadow-xl flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white/95">Verification & Execution</span>
            </div>
            <button
              onClick={handleOpenTerminal}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-neutral-200 border border-white/10 transition-colors"
            >
              Inspect Output Console
            </button>
          </div>

          <p className="text-neutral-300 text-[11px]">{report.summary}</p>

          {/* Test Badges */}
          {report.verification?.map((v: any, idx: number) => (
            <div 
              key={idx}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/5"
            >
              <span className="font-mono text-[11px] text-neutral-300 truncate max-w-[300px]">
                {v.command}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                v.status === 'passed' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {v.status === 'passed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {v.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
