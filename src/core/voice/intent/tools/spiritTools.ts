import { bundledSpirits } from '../../../../features/spirits/catalog';
import { useSpiritsStore } from '../../../../features/spirits/store';
import { resolveSpirit, type SpiritCommand } from '../../../../features/spirits/voiceControl';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { useLayoutStore } from '../../../layout/LayoutStore';
import type { ActionTool, ToolResult } from './types';

export function controlSpirit(command: SpiritCommand): ToolResult {
  const store = useSpiritsStore.getState();
  const spirits = [...bundledSpirits, ...store.customSpirits];
  const done = (message: string): ToolResult => ({ success: true, data: { message } });
  if (command.action === 'settings') {
    useSettingsStore.getState().setActiveSidebarCategory('spirits');
    const layout = useLayoutStore.getState();
    if (!layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
    return done('Opened Spirit settings.');
  }
  if (command.action === 'list') return done(`Available Spirits: ${spirits.map(s => s.name).join(', ') || 'none'}.`);
  if (command.action === 'size') {
    if (!Number.isFinite(command.size) || command.size! < 72 || command.size! > 192) return { success: false, error: 'Choose a Spirit size between 72 and 192 pixels.' };
    store.setSize(command.size!);
    return done(`Set Spirit size to ${command.size} pixels.`);
  }
  if (!command.name) return { success: false, error: 'Tell me the Spirit name, for example “show Mayank Spirit”.' };
  if (command.name.toLowerCase() === 'all') {
    if (command.action === 'remove') for (const id of store.activeIds) store.remove(id);
    else store.setEnabled(command.action === 'show');
    return done(command.action === 'show' ? 'Spirits are visible.' : 'Spirits are hidden from the desktop.');
  }
  const spirit = resolveSpirit(command.name, spirits);
  if (!spirit) return { success: false, error: `I couldn't find a Spirit named ${command.name}. Available Spirits: ${spirits.map(s => s.name).join(', ')}.` };
  if (command.action === 'show') {
    if (!store.activeIds.includes(spirit.id) && store.activeIds.length >= 12) return { success: false, error: 'Remove a Spirit first. Up to 12 can be on the desktop.' };
    store.add(spirit.id);
    store.setEnabled(true);
    return done(`${spirit.name} Spirit is now on your desktop.`);
  }
  store.remove(spirit.id);
  return done(`${spirit.name} Spirit is hidden from your desktop. You can add it again anytime.`);
}

export const spiritTools: ActionTool[] = [{
  declaration: {
    name: 'system_control_spirits',
    description: 'Show/add, hide/remove desktop Spirits by exact name (PIHU, Mayank or imported names), list available Spirits, open Spirit settings, or set their size. Removing a Spirit only removes it from the desktop and keeps its artwork available.',
    parameters: { type: 'OBJECT', properties: {
      action: { type: 'STRING', description: 'show, hide, remove, list, settings, or size' },
      name: { type: 'STRING', description: 'Exact Spirit name, or all for global visibility' },
      size: { type: 'NUMBER', description: 'Size in pixels, 72 to 192' },
    }, required: ['action'] },
  },
  execute: async args => {
    if (!['show','hide','remove','list','settings','size'].includes(args.action)) return { success: false, error: 'Unknown Spirit action.' };
    return controlSpirit(args as SpiritCommand);
  },
}];
