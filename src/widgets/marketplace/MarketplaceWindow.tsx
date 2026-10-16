import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ShoppingBag } from 'lucide-react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { Marketplace } from '../../features/marketplace/Marketplace';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useVoiceStore } from '../../stores/voiceStore';

export function MarketplaceWindow() {
  const close = () => {
    const layout = useLayoutStore.getState();
    if (layout.widgets['marketplace-window']?.isOpen) layout.toggleWidget('marketplace-window');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented || useVoiceStore.getState().isCommandPaletteOpen) return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openSettings = (category: 'connections' | 'spirits') => {
    useSettingsStore.getState().setActiveSidebarCategory(category);
    const layout = useLayoutStore.getState();
    if (layout.widgets['marketplace-window']?.isOpen) layout.toggleWidget('marketplace-window');
    if (!layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 sm:p-6 select-none"
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      onMouseDown={event => { if (event.target === event.currentTarget) close(); }}
    >
      <motion.div
        className="relative w-full max-w-5xl"
        initial={{ opacity: 0, scale: 0.92, y: 18, filter: 'blur(12px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.94, y: 10, filter: 'blur(8px)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.82 }}
      >
        <GlassCard blur="xl" frost="heavy" className="relative flex h-[min(760px,90vh)] w-full flex-col overflow-hidden rounded-3xl text-white font-sans" style={{ backgroundColor: 'rgba(18,18,18,0.18)', backdropFilter: 'blur(40px) saturate(115%)', WebkitBackdropFilter: 'blur(40px) saturate(115%)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3"><ShoppingBag size={18} className="text-pink-300" /><div><h1 className="text-sm font-semibold">PIHU Marketplace</h1><p className="text-[11px] text-white/50">Discover MCPs and Spirits</p></div></div>
            <button type="button" onClick={close} aria-label="Close Marketplace" title="Close" className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
            <Marketplace navigateTo={openSettings} />
          </main>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
