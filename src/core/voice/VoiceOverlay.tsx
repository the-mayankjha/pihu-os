import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceStore } from '../../stores/voiceStore';
import { useOrbStore } from '../orb/OrbStore';
import { OrbState } from '../../shared/components/Orb/states';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import loadingLottieUrl from '../../assets/lotties/loading.lottie?url';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const ExpandIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" 
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const VoiceOverlay: React.FC = () => {
  const { isActive, isListening, transcription, response } = useVoiceStore();
  const orbState = useOrbStore(state => state.currentState);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse when listening starts
  useEffect(() => {
    if (isListening) {
      setIsExpanded(false);
    }
  }, [isListening]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-4 flex justify-center"
        >
          <motion.div 
            layout 
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            className={`${isExpanded ? 'w-[700px] max-w-[90vw]' : 'w-auto min-w-[280px] max-w-[500px]'}`}
            style={{ borderRadius: isExpanded ? 24 : 32 }}
          >
            <GlassCard 
              blur="xl"
              frost="heavy"
              glow={isListening}
              className="p-3 shadow-2xl relative overflow-hidden ring-1 ring-white/10"
              style={{ borderRadius: isExpanded ? 24 : 32, backgroundColor: 'rgba(0,0,0,0.65)' }}
            >
              {/* Animated Glow Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 opacity-60 blur-2xl pointer-events-none" />

              <div className="relative flex flex-col w-full">
                
                {/* COMPACT MODE / TOP BAR (Dynamic Island Style) */}
                <div 
                  className={`flex items-center gap-3 px-2 py-1 ${response || (transcription && transcription.length > 40) ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (response || (transcription && transcription.length > 40)) {
                      setIsExpanded(!isExpanded);
                    }
                  }}
                >
                  {/* Left Icon Area */}
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 shadow-inner">
                    {isListening && (
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <MicIcon />
                      </motion.div>
                    )}
                    {!isListening && (orbState === OrbState.THINKING || orbState === OrbState.SPEAKING) && (
                      <div className="w-full h-full flex items-center justify-center scale-150">
                        <DotLottieReact
                          src={loadingLottieUrl}
                          loop
                          autoplay
                        />
                      </div>
                    )}
                  </div>

                  {/* Middle Text Area */}
                  <div className="flex-1 min-w-0 flex items-center pr-2">
                    <p className="text-white/90 text-sm md:text-base truncate font-medium">
                      {transcription ? `"${transcription}"` : (isListening ? 'Listening...' : 'Thinking...')}
                    </p>
                  </div>

                  {/* Right Action Area */}
                  {(response || (transcription && transcription.length > 40)) && (
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-colors text-white/60">
                      <ExpandIcon expanded={isExpanded} />
                    </div>
                  )}
                </div>

                {/* EXPANDED MODE CONTENT */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 mt-3 border-t border-white/10 w-full space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide px-3 pb-2">
                        {/* Transcription (Full) */}
                        {transcription && (
                          <div className="flex justify-center mb-6">
                            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 inline-block max-w-[90%]">
                              <p className="text-white/70 text-sm md:text-base font-medium italic text-center">
                                "{transcription}"
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Response */}
                        {!response && !isListening && (orbState === OrbState.THINKING || orbState === OrbState.SPEAKING) && (
                          <div className="flex justify-center items-center py-4">
                            <div className="w-16 h-16 opacity-80">
                              <DotLottieReact
                                src={loadingLottieUrl}
                                loop
                                autoplay
                              />
                            </div>
                          </div>
                        )}
                        
                        {response && !isListening && (
                          <div className="text-white/90 text-base md:text-lg font-normal tracking-wide flex flex-col gap-3 text-left leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                p: ({node, ...props}) => <p className="m-0" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-1 my-2" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal pl-6 space-y-1 my-2" {...props} />,
                                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2 text-white" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-3 mb-1 text-white" {...props} />,
                                code: ({node, ...props}) => <code className="bg-white/10 rounded px-1.5 py-0.5 font-mono text-sm" {...props} />
                              }}
                            >
                              {response}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
