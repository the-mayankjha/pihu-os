import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { bundledSpirits, saveSpiritSheet } from './catalog';
import { downloadSpirit, loadSpiritRegistry } from './registry';
import type { RegistrySpirit } from './registry';
import { useSpiritsStore } from './store';

export function SpiritMarket() {
  const { activeIds, customSpirits, add, importSpirit, setEnabled } = useSpiritsStore();
  const [packages, setPackages] = useState<RegistrySpirit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const installedIds = new Set([...bundledSpirits, ...customSpirits].map(spirit => spirit.id));
  const atLimit = activeIds.length >= 12;

  async function refresh() {
    setLoading(true);
    setError('');
    try { setPackages(await loadSpiritRegistry()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the Spirits catalog.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function install(entry: RegistrySpirit) {
    setError('');
    if (atLimit && !activeIds.includes(entry.id)) {
      setError('Remove a Spirit from the desktop before adding another.');
      return;
    }
    setBusyId(entry.id);
    try {
      if (installedIds.has(entry.id)) {
        add(entry.id);
      } else {
        const sheet = await downloadSpirit(entry);
        await saveSpiritSheet(entry.id, sheet);
        importSpirit({ id: entry.id, name: entry.name, description: entry.description });
      }
      setEnabled(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not install ${entry.name}.`);
    } finally {
      setBusyId(null);
    }
  }

  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 space-y-3" aria-labelledby="spirit-market-title">
    <div className="flex items-center justify-between gap-3">
      <div><h4 id="spirit-market-title" className="text-sm font-semibold">Spirit catalog</h4><p className="text-xs text-neutral-400 mt-1">Download artwork packages and add them to this computer.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Spirit catalog" className="rounded-lg bg-white/10 p-2 disabled:opacity-50"><RefreshCw size={14} /></button>
    </div>
    {loading && <p className="text-xs text-neutral-400">Loading Spirit catalog…</p>}
    {!loading && !error && packages.length === 0 && <p className="text-xs text-neutral-400">No Spirits are published yet.</p>}
    {packages.map(entry => {
      const installed = installedIds.has(entry.id);
      const active = activeIds.includes(entry.id);
      return <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="min-w-0"><p className="truncate text-xs font-semibold">{entry.name}</p><p className="mt-1 text-[11px] text-neutral-400">{entry.description}</p><p className="mt-1 text-[10px] text-neutral-500">v{entry.version} · {installed ? active ? 'On desktop' : 'Installed' : `${Math.ceil(entry.size_bytes / 1024 / 1024)} MB download`}</p></div>
        <button type="button" onClick={() => void install(entry)} disabled={busyId !== null || (atLimit && !active)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15 disabled:opacity-40">
          <Download size={13} />{busyId === entry.id ? 'Installing…' : active ? 'Added' : installed ? 'Add' : 'Install'}
        </button>
      </div>;
    })}
    {error && <p role="alert" className="rounded-lg bg-neutral-500/10 p-3 text-xs text-neutral-300">{error}</p>}
  </section>;
}
