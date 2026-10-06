import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceStore } from '../../stores/voiceStore';
import { useOrbStore } from '../orb/OrbStore';
import { OrbState } from '../../shared/components/Orb/states';
import { ThinkingOrb } from '../../shared/components/ThinkingOrb';
import { Folder, ChevronDown, Terminal, CheckCircle2, XCircle, FileCode, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { IdeCodeBlock } from './IdeCodeBlock';
import { executePendingProjectAction } from './intent/tools/projectTools';

export const VoiceOverlay: React.FC = () => {
  const { isActive, isListening, transcription, response, processingStatus, activeProject, pendingProjectAction, setPendingProjectAction } = useVoiceStore();
  const orbState = useOrbStore(state => state.currentState);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  // Auto-expand when code blocks or staged project actions are present
  useEffect(() => {
    if (pendingProjectAction || (response && response.includes('```'))) {
      setIsExpanded(true);
    }
  }, [pendingProjectAction, response]);

  // Keep collapsed while listening to avoid covering screen
  useEffect(() => {
    if (isListening) {
      setIsExpanded(false);
    }
  }, [isListening]);

  const getThinkingOrbState = (): 'idle' | 'listening' | 'thinking' | 'speaking' => {
    if (isListening) return 'listening';
    if (orbState === OrbState.THINKING) return 'thinking';
    if (orbState === OrbState.SPEAKING) return 'speaking';
    return 'idle';
  };

  const getDisplayText = () => {
    if (isListening) return transcription ? `"${transcription}"` : 'Listening...';
    if (orbState === OrbState.THINKING) return processingStatus || 'Thinking & formulating changes...';
    if (pendingProjectAction) return `Awaiting Confirmation: ${pendingProjectAction.title}`;
    if (orbState === OrbState.SPEAKING) return response ? response.slice(0, 70) + (response.length > 70 ? '...' : '') : 'Speaking...';
    if (response) return response.slice(0, 70) + (response.length > 70 ? '...' : '');
    return 'Ready';
  };

  const handleApplyChanges = async () => {
    setIsApplying(true);
    try {
      const res = await executePendingProjectAction();
      if (res.success) {
        useVoiceStore.getState().setResponse(`Done Sir Mayank! Applied all staged changes for "${pendingProjectAction?.title}".`);
      }
    } catch (err) {
      console.error('Failed to apply staged changes:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelChanges = () => {
    setPendingProjectAction(null);
    useVoiceStore.getState().setResponse('Cancelled proposed changes.');
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 flex flex-col items-center pointer-events-auto"
        >
          {/* Main Dynamic Island Capsule */}
          <motion.div 
            layout 
            transition={{ duration: 0.3, type: "spring", bounce: 0.15 }}
            className={`bg-slate-950/90 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white relative overflow-hidden ${
              isExpanded ? 'w-[760px] max-w-[94vw] rounded-3xl p-5' : 'w-auto min-w-[320px] max-w-[560px] rounded-full px-4 py-2.5'
            }`}
          >
            {/* Ambient Multi-Color Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 opacity-80 blur-xl pointer-events-none" />

            {/* Dynamic Island Header Bar */}
            <div 
              className="relative flex items-center justify-between gap-3 cursor-pointer select-none"
              onClick={() => {
                if (response || processingStatus || pendingProjectAction || (transcription && transcription.length > 25)) {
                  setIsExpanded(!isExpanded);
                }
              }}
            >
              {/* Thinking Orb Indicator Icon */}
              <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white/5 border border-white/10 shadow-inner">
                <ThinkingOrb state={getThinkingOrbState()} size={24} />
              </div>

              {/* Status Text / Transcription */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <p className="text-white/90 text-sm font-medium truncate">
                  {getDisplayText()}
                </p>
                {activeProject && !isExpanded && !pendingProjectAction && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full flex-shrink-0">
                    <Folder className="w-3 h-3 text-purple-300" />
                    <span>{activeProject.name}</span>
                  </span>
                )}
                {pendingProjectAction && !isExpanded && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">
                    <span>Needs Confirmation</span>
                  </span>
                )}
              </div>

              {/* Expand Toggle */}
              {(response || processingStatus || pendingProjectAction || (transcription && transcription.length > 25)) && (
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              )}
            </div>

            {/* Expanded Content View */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden relative pt-4 mt-3 border-t border-white/10"
                >
                  {/* Full User Request */}
                  {transcription && (
                    <div className="mb-3 text-xs text-slate-400 font-mono flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-purple-400">User Prompt:</span> "{transcription}"
                    </div>
                  )}

                  {/* Active Project Badge in Expanded Mode */}
                  {activeProject && (
                    <div className="mb-3 text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-purple-300" />
                        <span>Active Project: <strong>{activeProject.name}</strong></span>
                      </span>
                      <span className="text-slate-400 text-[11px] truncate max-w-[280px]">{activeProject.dir}</span>
                    </div>
                  )}

                  {/* ─── PENDING PROJECT / CODE MODIFICATION CONFIRMATION CARD ─── */}
                  {pendingProjectAction && (
                    <div className="mb-4 p-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-2xl">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 text-purple-300 font-medium text-sm">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span>{pendingProjectAction.title}</span>
                        </div>
                        <span className="text-xs font-mono text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                          {pendingProjectAction.files.length} file(s) staged
                        </span>
                      </div>

                      {/* File Tabs */}
                      {pendingProjectAction.files.length > 1 && (
                        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-thin">
                          {pendingProjectAction.files.map((file, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedFileIndex(idx)}
                              className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                selectedFileIndex === idx
                                  ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              <FileCode className="w-3 h-3 text-purple-400" />
                              <span className="truncate max-w-[150px]">{file.path.split('/').pop()}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Staged Code Viewer */}
                      {pendingProjectAction.files[selectedFileIndex] && (
                        <IdeCodeBlock
                          filename={pendingProjectAction.files[selectedFileIndex].path}
                          language={pendingProjectAction.files[selectedFileIndex].language || 'tsx'}
                        >
                          {pendingProjectAction.files[selectedFileIndex].content}
                        </IdeCodeBlock>
                      )}

                      {/* Action Confirmation Buttons */}
                      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
                        <div className="text-[11px] text-slate-400 font-mono">
                          Say <strong className="text-emerald-400">"Yes / Apply"</strong> or click to confirm.
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCancelChanges}
                            disabled={isApplying}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Cancel</span>
                          </button>

                          <button
                            onClick={handleApplyChanges}
                            disabled={isApplying}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition cursor-pointer"
                          >
                            {isApplying ? (
                              <ThinkingOrb state="thinking" size={14} />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>{isApplying ? 'Applying Changes...' : 'Apply Changes'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Processing Status Banner when details requested */}
                  {processingStatus && !response && (
                    <div className="py-2.5 px-4 bg-slate-900/60 border border-purple-500/20 rounded-2xl text-xs text-purple-200 flex items-center gap-3">
                      <ThinkingOrb state="thinking" size={20} />
                      <span>{processingStatus}</span>
                    </div>
                  )}

                  {/* Full Response Markdown with IDE Code Block Component */}
                  {response && (
                    <div className="text-white/90 text-sm font-normal leading-relaxed max-h-[55vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({node, ...props}) => <p className="m-0 mb-2" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 my-2 text-slate-200" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 my-2 text-slate-200" {...props} />,
                          li: ({node, ...props}) => <li className="pl-0.5" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-3 mb-1 text-white" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-base font-bold mt-3 mb-1 text-white" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-2 mb-1 text-white" {...props} />,
                          code: ({node, className, children, ...props}) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isMultiLine = String(children).includes('\n') || (match && match[1]);

                            if (isMultiLine) {
                              return (
                                <IdeCodeBlock language={match ? match[1] : 'text'}>
                                  {String(children)}
                                </IdeCodeBlock>
                              );
                            }

                            return (
                              <code className="bg-white/10 rounded px-1.5 py-0.5 font-mono text-xs text-purple-300" {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {response}
                      </ReactMarkdown>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

