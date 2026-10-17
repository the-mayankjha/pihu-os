import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLayoutStore } from '../layout/LayoutStore';
import { VoiceManager } from './VoiceManager';
import { matchesAccelerator } from '../shortcuts';
import { useVoiceStore } from '../../stores/voiceStore';

const GLOBAL_ACTIONS = ['voice', 'globalCommandPalette'] as const;

export function GlobalShortcutHost() {
  const keybindings = useSettingsStore(state => state.keybindings);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    void (async () => {
      for (const action of GLOBAL_ACTIONS) {
        if (cancelled) return;
        try {
          await invoke('set_global_shortcut', { action, accelerator: keybindings[action] });
        } catch (error) {
          console.error(`[SHORTCUTS] Could not register ${action}:`, error);
          window.dispatchEvent(new CustomEvent('pihu-shortcut-error', {
            detail: `Could not register ${keybindings[action]}: ${String(error)}`,
          }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [keybindings]);

  useEffect(() => {
    const runAction = (action: string) => {
      switch (action) {
        case 'voice':
          void VoiceManager.getInstance().startListening(false);
          break;
        case 'settings':
          useLayoutStore.getState().toggleWidget('settings-window');
          break;
        case 'tasks':
          useLayoutStore.getState().toggleWidget('task-window');
          break;
        case 'music':
          useLayoutStore.getState().toggleWidget('ytmusic-plugin');
          break;
        case 'marketplace':
          useLayoutStore.getState().toggleWidget('marketplace-window');
          break;
        case 'commandPalette':
          useVoiceStore.getState().toggleCommandPalette();
          break;
      }
    };

    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      void listen<string>('pihu-global-shortcut', async event => {
        // Keep the current external app frontmost until VoiceManager captures it
        // as the target for the upcoming voice command.
        if (event.payload !== 'voice') {
          try {
            const main = getCurrentWindow();
            await main.show();
            await main.unminimize();
            await main.setFocus();
          } catch (error) {
            console.debug('[SHORTCUTS] Could not focus PIHU main window:', error);
          }
        }
        runAction(event.payload);
      }).then(stop => { unlisten = stop; });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesAccelerator(event, keybindings.commandPalette)) {
        event.preventDefault();
        runAction('commandPalette');
        return;
      }
      const localActions = isTauri() ? ['settings', 'tasks', 'music', 'marketplace'] as const : ['voice', 'settings', 'tasks', 'music', 'marketplace'] as const;
      for (const action of localActions) {
        if (matchesAccelerator(event, keybindings[action])) {
          event.preventDefault();
          runAction(action);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unlisten?.();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [keybindings]);

  return null;
}
