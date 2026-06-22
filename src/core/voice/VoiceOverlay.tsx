import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceStore } from '../../stores/voiceStore';
import { useOrbStore } from '../orb/OrbStore';
import { OrbState } from '../../shared/components/Orb/states';
import { Waveform } from '../../shared/components/Orb/Waveform';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

export const VoiceOverlay: React.FC = () => {
  const { isActive, isListening, transcription, response } = useVoiceStore();
  const orbState = useOrbStore(state => state.state);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-12 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
        >
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Animated Glow Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 opacity-50 blur-xl pointer-events-none" />

            <div className="relative flex flex-col items-center gap-6">
              
              {/* Header / Status */}
              {orbState !== OrbState.THINKING && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center justify-center">
                    {isListening && (
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="p-3 bg-pink-500/20 rounded-full"
                      >
                        <MicIcon />
                      </motion.div>
                    )}
                    {orbState === OrbState.SPEAKING && (
                      <div className="w-[120px]">
                        <Waveform state={orbState} size={40} />
                      </div>
                    )}
                  </div>
                  
                  {isListening && (
                    <span className="text-sm font-medium uppercase tracking-widest text-pink-400">
                      Pihu is Listening...
                    </span>
                  )}
                </div>
              )}

              {/* Text Display */}
              <div className="w-full space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide pr-2">
                {/* Transcription (What the user is saying) */}
                {transcription && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white/60 text-base md:text-lg font-light italic text-center mb-4"
                  >
                    "{transcription}"
                  </motion.div>
                )}

                {/* Response (What Pihu is saying back) */}
                {response && !isListening && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white/90 text-base md:text-lg font-normal tracking-wide flex flex-col gap-3 text-left leading-relaxed"
                  >
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
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
