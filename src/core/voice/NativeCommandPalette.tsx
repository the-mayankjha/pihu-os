import { useEffect } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { useVoiceStore } from '../../stores/voiceStore';
import { VoiceManager } from './VoiceManager';
import { CommandPalette } from '../../shared/components/CommandPalette/CommandPalette';

export function NativeCommandPaletteHost() {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let visible = false;
    let queue = Promise.resolve();
    const setVisible = (next: boolean) => {
      visible = next;
      queue = queue.catch(() => {}).then(async () => {
        if (disposed) return;
        await invoke('sync_command_palette', { visible: next });
        await emitTo('command-palette', next ? 'command-palette-show' : 'command-palette-hide');
      }).catch(console.error);
    };
    const listeners = [
      listen('pihu-command-palette-global-toggle', () => setVisible(!visible)),
      listen('command-palette-close', () => setVisible(false)),
      listen<string>('command-palette-submit', event => {
        const text = event.payload?.trim();
        setVisible(false);
        if (text) VoiceManager.getInstance().processTextInput(text);
      }),
      listen('command-palette-ready', () => {
        if (visible) void emitTo('command-palette', 'command-palette-show').catch(console.error);
      }),
    ];
    return () => { disposed = true; listeners.forEach(listener => void listener.then(stop => stop())); };
  }, []);
  return null;
}

export function NativeCommandPaletteWindow() {
  useEffect(() => {
    let receiving = false;
    const listeners = [
      listen('command-palette-show', () => {
        receiving = true;
        useVoiceStore.getState().setIsCommandPaletteOpen(true);
        receiving = false;
      }),
      listen('command-palette-hide', () => {
        receiving = true;
        useVoiceStore.getState().setIsCommandPaletteOpen(false);
        receiving = false;
      }),
    ];
    const stop = useVoiceStore.subscribe((state, previous) => {
      if (receiving || state.isCommandPaletteOpen === previous.isCommandPaletteOpen) return;
      if (!state.isCommandPaletteOpen) void emitTo('main', 'command-palette-close').catch(console.error);
    });
    void emitTo('main', 'command-palette-ready').catch(console.error);
    return () => { stop(); listeners.forEach(listener => void listener.then(unlisten => unlisten())); };
  }, []);
  return <CommandPalette nativeWindow />;
}
