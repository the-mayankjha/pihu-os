import { useEffect } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { useVoiceStore } from '../../stores/voiceStore';
import { useOrbStore } from '../orb/OrbStore';
import { VoiceOverlay } from './VoiceOverlay';
import { VoiceManager } from './VoiceManager';
const snapshot = () => Object.fromEntries(Object.entries(useVoiceStore.getState()).filter(([,v]) => typeof v !== 'function'));

export function NativeVoiceOverlayHost() {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const publish = () => {
      void emitTo('voice-overlay', 'voice-snapshot', { voice: snapshot(), orb: useOrbStore.getState().currentState }).catch(() => {});
    };
    let sync = Promise.resolve();
    let lastVisible: boolean | undefined;
    const update = () => {
      publish();
      const visible = useVoiceStore.getState().isActive;
      if (visible === lastVisible) return;
      lastVisible = visible;
      sync = sync.then(async () => { if (!disposed) await invoke('sync_voice_overlay', { visible }); }).catch(console.error);
    };
    const stops = [useVoiceStore.subscribe(update), useOrbStore.subscribe(publish)];
    const listeners = [
      listen('voice-overlay-ready', publish),
      listen<Record<string, unknown>>('voice-overlay-edit', e => {
        // Only state fields already present in the owner may be updated.
        const state = useVoiceStore.getState();
        const patch = Object.fromEntries(Object.entries(e.payload).filter(([key]) => key in state && typeof state[key as keyof typeof state] !== 'function'));
        useVoiceStore.setState(patch);
      }),
      listen('voice-overlay-escape', () => VoiceManager.getInstance().handleEscape()),
    ];
    update();
    return () => { disposed = true; stops.forEach(stop => stop()); listeners.forEach(p => void p.then(stop => stop())); };
  }, []);
  return isTauri() ? null : <VoiceOverlay />;
}

export function NativeVoiceOverlayWindow() {
  useEffect(() => {
    let receiving = false;
    const listener = listen<{voice: Record<string, unknown>; orb: any}>('voice-snapshot', e => {
      receiving = true;
      useVoiceStore.setState(e.payload.voice);
      useOrbStore.setState({ currentState: e.payload.orb });
      receiving = false;
    });
    const stop = useVoiceStore.subscribe((state, previous) => {
      if (receiving) return;
      const patch = Object.fromEntries(Object.entries(state).filter(([key,value]) => typeof value !== 'function' && value !== previous[key as keyof typeof previous]));
      void emitTo('main', 'voice-overlay-edit', patch);
    });
    void listener.then(() => emitTo('main', 'voice-overlay-ready'));
    const observer = new ResizeObserver(() => {
      const card = document.querySelector('[data-testid="voice-overlay"]');
      if (card) void getCurrentWindow().setSize(new LogicalSize(900, Math.min(screen.availHeight - 60, Math.ceil(card.getBoundingClientRect().height + 48)))).catch(console.error);
    });
    observer.observe(document.body);
    const mutation = new MutationObserver(() => {
      const card = document.querySelector('[data-testid="voice-overlay"]');
      if (card) observer.observe(card);
    });
    mutation.observe(document.body, { childList: true, subtree: true });
    return () => { stop(); observer.disconnect(); mutation.disconnect(); void listener.then(stop => stop()); };
  }, []);
  return <VoiceOverlay />;
}
