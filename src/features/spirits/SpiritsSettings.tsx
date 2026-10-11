import { FrostSelect } from '../../shared/components/FrostSelect/FrostSelect';
import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { saveSpiritSheet } from './catalog';
import { SPIRIT_SHORTCUTS, SPIRIT_STATE_LABELS, validateSheetDimensions, validateSheetPixels } from './model';
import type { SpiritShortcut, ToolbarMode } from './model';
import { SpiritMarket } from './SpiritMarket';
import { useSpiritsStore } from './store';

export function SpiritsSettings() {
  const { enabled, setEnabled, activeIds, size, setSize, importSpirit, error, shortcuts, setShortcut, toolbar, setToolbar } = useSpiritsStore();
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const atLimit = activeIds.length >= 12;
  async function importFile(file: File) {
    setImportError('');
    setImporting(true);
    let url = '';
    try {
      if (!['image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('Choose a PNG or WebP sprite sheet under 20 MB.');
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      validateSheetDimensions(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Could not inspect the sprite sheet.');
      context.drawImage(image, 0, 0);
      validateSheetPixels(canvas.width, canvas.height, context.getImageData(0, 0, canvas.width, canvas.height).data);
      const spirit = { id: `custom-${crypto.randomUUID()}`, name: file.name.replace(/\.(png|webp)$/i, '').replace(/[-_]/g, ' ').slice(0, 60) || 'My Spirit', description: 'Your imported Spirit.', custom: true };
      await saveSpiritSheet(spirit.id, file);
      importSpirit(spirit);
      setEnabled(true);
    } catch (e) { setImportError(e instanceof Error ? e.message : String(e)); }
    finally { URL.revokeObjectURL(url); setImporting(false); if (input.current) input.current.value = ''; }
  }
  return <div className="space-y-6">
    <div className="p-5 rounded-2xl bg-white/[0.06] backdrop-blur-xl   border border-white/10 flex justify-between gap-4 items-center">
      <div><h3 className="font-semibold flex gap-2 items-center"><Sparkles size={18} className="text-neutral-300" />Spirits</h3><p className="text-xs text-neutral-400 mt-2">Little companions that stay above your windows while Pihu is open. Drag to move them; click to say hello.</p></div>
      <button role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${enabled ? 'bg-neutral-500 text-white' : 'bg-white/10 text-neutral-300'}`}>{enabled ? 'On' : 'Off'}</button>
    </div>
    <label className="flex items-center gap-4 text-xs">Spirit size<input aria-label="Spirit size" type="range" min={72} max={192} value={size} onChange={e => setSize(Number(e.target.value))} className="flex-1 accent-neutral-500" /><span className="text-neutral-400">{size}px</span></label>
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold">Hover shortcuts</h4>
      <p className="text-xs text-neutral-400">Choose the three shortcuts shown when you hover over a Spirit.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-400">
        <div>Visibility<FrostSelect label="Shortcut visibility" value={toolbar.mode} onChange={value => setToolbar({ ...toolbar, mode: value as ToolbarMode })}
          options={[{ value: 'auto', label: 'Auto-hide' }, { value: 'hover', label: 'Hover only' }, { value: 'always', label: 'Always visible' }, { value: 'hidden', label: 'Hidden' }]} /></div>
        {toolbar.mode === 'auto' && <div>Hide after<FrostSelect label="Shortcut hide delay" value={String(toolbar.delay)} onChange={value => setToolbar({ ...toolbar, delay: Number(value) })}
          options={[{ value: '500', label: '0.5 seconds' }, { value: '1000', label: '1 second' }, { value: '2000', label: '2 seconds' }, { value: '4000', label: '4 seconds' }]} /></div>}
      </div>
      <div className="grid grid-cols-3 gap-3">{shortcuts.map((shortcut, index) => <label key={index} className="text-xs text-neutral-400">Shortcut {index + 1}
        <FrostSelect label={`Shortcut ${index+1}`} value={shortcut} onChange={value=>setShortcut(index,value as SpiritShortcut)} options={Object.entries(SPIRIT_SHORTCUTS).map(([value,label])=>({value,label}))} />
      </label>)}</div>
    </div>
    {(error || importError) && <p role="alert" className="text-xs text-neutral-300 bg-neutral-500/10 p-3 rounded-xl">{importError || error}</p>}
    <input ref={input} className="hidden" type="file" accept="image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); }} />
    <SpiritMarket onImport={() => input.current?.click()} importLabel={importing ? 'Importing…' : 'Import Spirit'} importDisabled={importing || atLimit} />
    {atLimit && <p className="text-xs text-amber-300">Remove a Spirit before adding another (up to 12 at once).</p>}
    <details className="rounded-xl border border-white/10 p-3 text-xs">
      <summary className="cursor-pointer text-neutral-300">Agent and movement states</summary>
      <table className="w-full mt-3 text-left"><thead><tr className="text-neutral-500"><th className="pb-2 font-medium">Pihu activity</th><th className="pb-2 font-medium">Spirit animation</th></tr></thead><tbody>{SPIRIT_STATE_LABELS.map(([activity, animation]) => <tr key={activity} className="border-t border-white/5"><td className="py-2 text-neutral-400">{activity}</td><td className="py-2 text-neutral-300">{animation}</td></tr>)}</tbody></table>
    </details>
    <p className="text-[11px] text-neutral-500">Import a transparent sprite sheet: 1536 × 1872 or 1536 × 2288, PNG or WebP, up to 20 MB. Spirits and your selection are saved on this computer.</p>
  </div>;
}
