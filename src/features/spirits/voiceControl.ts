import type { Spirit } from './model';

export type SpiritCommand = { action: 'show' | 'hide' | 'remove' | 'list' | 'settings' | 'size'; name?: string; size?: number };

export function parseSpiritCommand(text: string): SpiritCommand | null {
  const command = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/^(?:can you|could you|please)\s+/, '').replace(/\s+please$/, '').replace(/\s+from (?:the )?desktop$/, '');
  if (/^(?:open|show|configure|manage)\s+(?:the\s+)?spirits?\s+(?:settings|controls)$/.test(command)) return { action: 'settings' };
  if (/^(?:list|show|what are)\s+(?:my\s+|available\s+)?spirits$/.test(command)) return { action: 'list' };
  const size = command.match(/^(?:set|change)\s+(?:the\s+)?spirits?\s+size\s+(?:to\s+)?(\d+)\s*(?:px|pixels)?$/);
  if (size) return { action: 'size', size: Number(size[1]) };
  const match = command.match(/^(add|show|enable|bring back|hide|remove|disable)\s+(?:the\s+)?(.+?)\s+spirits?$/) || command.match(/^(add|show|enable|bring back|hide|remove|disable)\s+(?:the\s+)?spirits?\s+(.+)$/);
  if (match) return { action: /^(hide|disable)$/.test(match[1]) ? 'hide' : match[1] === 'remove' ? 'remove' : 'show', name: match[2].replace(/\s+from (?:the )?desktop$/, '') };
  const all = command.match(/^(show|enable|hide|disable|remove)\s+(?:all\s+)?spirits$/);
  if (all) return { action: /^(show|enable)$/.test(all[1]) ? 'show' : all[1] === 'remove' ? 'remove' : 'hide', name: 'all' };
  return null;
}

export function resolveSpirit(name: string, spirits: Spirit[]): Spirit | undefined {
  const normalized = name.trim().toLowerCase();
  return spirits.find(spirit => spirit.id.toLowerCase() === normalized || spirit.name.toLowerCase() === normalized);
}
