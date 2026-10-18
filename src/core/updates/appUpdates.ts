import { create } from 'zustand';
import { isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLayoutStore } from '../layout/LayoutStore';

type Phase = 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'installing' | 'ready' | 'error';
interface State { phase: Phase; version: string; notes: string; bytes: number; total: number; checkedAt: number; error: string; prompt: boolean }
export const useAppUpdates = create<State>(() => ({ phase:'idle', version:'', notes:'', bytes:0, total:0, checkedAt:0, error:'', prompt:false }));
let candidate: Update | null = null;
let checking: Promise<void> | null = null;
let installing = false;
export function openUpdates() {
  useSettingsStore.getState().setActiveSidebarCategory('general');
  const layout = useLayoutStore.getState();
  if (!layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
}
export function checkAppUpdates(prompt = false): Promise<void> {
  if (checking) return checking;
  if (installing) return Promise.resolve();
  checking = (async () => {
    useAppUpdates.setState({phase:'checking', error:''});
    try {
      if (!isTauri()) throw new Error('Updates are available in the installed desktop app.');
      if (candidate) { await candidate.close(); candidate = null; }
      candidate = await check({timeout:30000, headers:{'Cache-Control':'no-cache'}});
      useAppUpdates.setState({phase:candidate?'available':'current', version:candidate?.version || '', notes:candidate?.body || '', checkedAt:Date.now(), prompt:Boolean(candidate && prompt)});
    } catch (error) {
      useAppUpdates.setState({phase:'error', error:String(error), checkedAt:Date.now()});
    }
  })().finally(() => { checking = null; });
  return checking;
}
export async function installAppUpdate() {
  if (installing || !candidate) return;
  installing = true;
  const update = candidate;
  useAppUpdates.setState({phase:'downloading', bytes:0, total:0, error:'', prompt:false});
  try {
    // The native timeout bounds stalled requests; keep one download in flight.
    await update.download(event => {
      if (event.event === 'Started') useAppUpdates.setState({total:event.data.contentLength || 0});
      if (event.event === 'Progress') useAppUpdates.setState(state => ({bytes:state.bytes + event.data.chunkLength}));
    }, {timeout:1800000});
    useAppUpdates.setState({phase:'installing'});
    await update.install();
    useAppUpdates.setState({phase:'ready'});
  } catch (error) {
    useAppUpdates.setState({phase:'error', error:`${String(error)}. Retry or download the installer from the release page.`});
  } finally { installing = false; }
}
export async function restartForUpdate() {
  try { await relaunch(); } catch (error) { useAppUpdates.setState({error:`Restart PIHU manually: ${String(error)}`}); }
}
