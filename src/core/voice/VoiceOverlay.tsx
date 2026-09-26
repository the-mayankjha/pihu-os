import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceStore } from '../../stores/voiceStore';
import { useOrbStore } from '../orb/OrbStore';
import { OrbState } from '../../shared/components/Orb/states';
import { ThinkingOrb } from '../../shared/components/ThinkingOrb';
import { Folder, ChevronDown, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export const VoiceOverlay: React.FC = () => {
  const { isActive, isListening, transcription, response, processingStatus, activeProject } = useVoiceStore();
  const orbState = useOrbStore(state => state.currentState);
  const [isExpanded, setIsExpanded] = useState(false);

  // Keep collapsed while thinking/listening to avoid huge popups covering the screen
  useEffect(() => {
    if (isListening || orbState === OrbState.THINKING) {
      setIsExpanded(false);
    }
  }, [isListening, orbState]);

  const getThinkingOrbState = (): 'idle' | 'listening' | 'thinking' | 'speaking' => {
    if (isListening) return 'listening';
    if (orbState === OrbState.THINKING) return 'thinking';
    if (orbState === OrbState.SPEAKING) return 'speaking';
    return 'idle';
  };

  const getDisplayText = () => {
    if (isListening) return transcription ? `"${transcription}"` : 'Listening...';
    if (orbState === OrbState.THINKING) return processingStatus || 'Thinking & planning actions...';
    if (orbState === OrbState.SPEAKING) return response ? response.slice(0, 70) + (response.length > 70 ? '...' : '') : 'Speaking...';
    if (response) return response.slice(0, 70) + (response.length > 70 ? '...' : '');
    return 'Ready';
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
              isExpanded ? 'w-[680px] max-w-[92vw] rounded-3xl p-5' : 'w-auto min-w-[320px] max-w-[560px] rounded-full px-4 py-2.5'
            }`}
          >
            {/* Ambient Multi-Color Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 opacity-80 blur-xl pointer-events-none" />

            {/* Dynamic Island Header Bar */}
            <div 
              className="relative flex items-center justify-between gap-3 cursor-pointer select-none"
              onClick={() => {
                if (response || processingStatus || (transcription && transcription.length > 25)) {
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
                {activeProject && !isExpanded && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full flex-shrink-0">
                    <Folder className="w-3 h-3 text-purple-300" />
                    <span>{activeProject.name}</span>
                  </span>
                )}
              </div>

              {/* Expand Toggle */}
              {(response || processingStatus || (transcription && transcription.length > 25)) && (
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
                      <span className="text-slate-400">{activeProject.dir}</span>
                    </div>
                  )}

                  {/* Processing Status Banner when details requested */}
                  {processingStatus && !response && (
                    <div className="py-2.5 px-4 bg-slate-900/60 border border-purple-500/20 rounded-2xl text-xs text-purple-200 flex items-center gap-3">
                      <ThinkingOrb state="thinking" size={20} />
                      <span>{processingStatus}</span>
                    </div>
                  )}

                  {/* Full Response Markdown */}
                  {response && (
                    <div className="text-white/90 text-sm font-normal leading-relaxed max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20">
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
                          code: ({node, ...props}) => <code className="bg-white/10 rounded px-1.5 py-0.5 font-mono text-xs text-purple-300" {...props} />
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
