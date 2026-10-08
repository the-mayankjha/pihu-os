import { useId } from 'react';
import type { CSSProperties } from 'react';
import { Mic, Settings, Command, ListTodo, LayoutGrid, Music } from 'lucide-react';
import { SPIRIT_SHORTCUTS } from './model';
import type { SpiritShortcut } from './model';
import './SpiritToolbar.css';

const icons = { voice: Mic, settings: Settings, commands: Command, tasks: ListTodo, widgets: LayoutGrid, music: Music };

export function SpiritToolbar({ name, size, shortcuts, disabled, onShortcut }: { name: string; size: number; shortcuts: SpiritShortcut[]; disabled: boolean; onShortcut: (shortcut: SpiritShortcut) => void }) {
  const filterId = `spirit-goo-${useId().replace(/:/g, '')}`;
  const diameter = Math.min(32, (size - 12) / 3);
  return <div role="toolbar" aria-label={`${name} shortcuts`} className={`spirit-toolbar${disabled ? ' is-dragging' : ''}`} style={{ width: size, '--spirit-button': `${diameter}px`, '--spirit-spread': `${diameter + 4}px` } as CSSProperties}>
    <svg width="0" height="0" aria-hidden="true" className="spirit-goo-defs"><defs><filter id={filterId} x="-50%" y="-100%" width="200%" height="300%" colorInterpolationFilters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="3" /><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" /><feComposite in="SourceGraphic" operator="atop" /></filter></defs></svg>
    <div className="spirit-goo" aria-hidden="true" style={{ filter: `url(#${filterId})` }}><i /><i /><i /></div>
    <span className="spirit-handle" aria-hidden="true" />
    {shortcuts.map((shortcut, index) => {
      const Icon = icons[shortcut];
      return <button key={index} type="button" disabled={disabled} aria-label={SPIRIT_SHORTCUTS[shortcut]} title={SPIRIT_SHORTCUTS[shortcut]} className="spirit-shortcut" style={{ '--slot': index - 1 } as CSSProperties} onClick={() => onShortcut(shortcut)}><Icon size={Math.min(16, size / 5)} strokeWidth={1.8} /></button>;
    })}
  </div>;
}
