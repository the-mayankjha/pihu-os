import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emitTo } from '@tauri-apps/api/event';
import { Search } from 'lucide-react';
import { useVoiceStore } from '../../../stores/voiceStore';
import { VoiceManager } from '../../../core/voice/VoiceManager';
import { matchesAccelerator } from '../../../core/shortcuts';
import { useSettingsStore } from '../../../stores/settingsStore';

export const CommandPalette: React.FC<{ nativeWindow?: boolean }> = ({ nativeWindow = false }) => {
  const { isCommandPaletteOpen, setIsCommandPaletteOpen } = useVoiceStore();
  const commandPaletteShortcut = useSettingsStore(state => state.keybindings.commandPalette);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // The main app host handles its shortcut; the standalone native palette
  // window needs a listener because it runs in a separate webview.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen(false);
        return;
      }

      if (nativeWindow && matchesAccelerator(e, commandPaletteShortcut)) {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteShortcut, isCommandPaletteOpen, nativeWindow, setIsCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const textToRun = query.trim();
    if (!textToRun) return;

    // 1. Close command palette
    setIsCommandPaletteOpen(false);
    setQuery('');

    if (nativeWindow) void emitTo('main', 'command-palette-submit', textToRun).catch(console.error);
    else VoiceManager.getInstance().processTextInput(textToRun);
  };

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <motion.div
          key="command-palette-overlay"
          className={`fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[min(18vh,9rem)] ${nativeWindow ? 'bg-transparent backdrop-blur-0' : 'bg-black/20 backdrop-blur-[2px]'} pointer-events-auto select-none`}
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(2px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          {/* The glass droplet widens directly into the search surface, without separate accent dots. */}
          <div className="relative w-full max-w-[760px]">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="PIHU Command Palette"
              initial={{ opacity: 0.72, width: 72, height: 72, borderRadius: '50%', filter: 'blur(1px)', backgroundColor: 'rgba(194,207,224,0.2)', borderColor: 'rgba(255,255,255,0.4)' }}
              animate={{ opacity: 1, width: '100%', height: 78, borderRadius: '24px', filter: 'blur(0px)', backgroundColor: 'rgba(255,255,255,0.065)', borderColor: 'rgba(255,255,255,0.2)' }}
              exit={{ opacity: 0, width: 72, height: 72, borderRadius: '50%', filter: 'blur(2px)' }}
              transition={{ width: { duration: 0.94, delay: 0.18, ease: [0.2, 0.85, 0.2, 1] }, height: { duration: 0.78, delay: 0.34, ease: [0.2, 0.85, 0.2, 1] }, borderRadius: { duration: 0.72, delay: 0.28, ease: [0.2, 0.85, 0.2, 1] }, opacity: { duration: 0.24 }, filter: { duration: 0.65 }, backgroundColor: { duration: 0.72, delay: 0.25 }, borderColor: { duration: 0.65, delay: 0.3 } }}
              onClick={(e) => e.stopPropagation()}
              style={{ backdropFilter: 'blur(24px) saturate(115%)' }}
              className="group relative mx-auto w-full origin-center overflow-hidden border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.25)]"
            >
              {/* Soft surface reflections; kept independent from the controls below. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/[0.07] via-transparent to-white/[0.012]" />

              <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.96, ease: 'easeOut' }}
                className="absolute inset-0 flex w-full items-center gap-4 rounded-[20px] px-5 py-3 sm:px-6"
              >
                <Search className="h-5 w-5 shrink-0 text-white/75" strokeWidth={1.8} aria-hidden="true" />

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask PIHU anything · /update for software updates"
                  className="min-w-0 flex-1 bg-transparent py-1 text-[15px] font-medium tracking-[0.005em] text-white outline-none placeholder:font-normal placeholder:text-neutral-300/65 focus:outline-none sm:text-base"
                  autoComplete="off"
                  spellCheck={false}
                />
              </motion.form>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
