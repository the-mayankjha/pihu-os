import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { bundledSpirits, saveSpiritSheet } from './catalog';
import { downloadSpirit, loadSpiritRegistry } from './registry';
import { SpiritMarketPreview } from './SpiritMarketPreview';
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

  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 space-y-4" aria-labelledby="spirit-market-title">
    <div className="flex items-center justify-between gap-3">
      <div><h4 id="spirit-market-title" className="text-sm font-semibold">Spirit catalog</h4><p className="text-xs text-neutral-400 mt-1">Download artwork packages and add them to this computer.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Spirit catalog" className="rounded-lg bg-white/10 p-2 disabled:opacity-50"><RefreshCw size={14} /></button>
    </div>
    {loading && <p className="py-6 text-center text-xs text-neutral-400">Loading Spirit catalog…</p>}
    {!loading && !error && packages.length === 0 && <p className="py-6 text-center text-xs text-neutral-400">No Spirits are published yet.</p>}
    {!loading && packages.length > 0 && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{packages.map(entry => {
      const installed = installedIds.has(entry.id);
      const active = activeIds.includes(entry.id);
      return <article key={entry.id} className="flex min-h-48 flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/20 hover:bg-white/[0.055]">
        <div className="flex min-h-28 items-center gap-4">
          <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl bg-white/[0.035] p-2">
            <SpiritMarketPreview name={entry.name} src={entry.preview_url} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h5 className="truncate text-sm font-semibold text-white">{entry.name}</h5>{active && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200">On desktop</span>}</div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-neutral-400">{entry.description}</p>
            <p className="mt-2 text-[11px] text-neutral-300">{entry.author}</p>
            <p className="mt-1 text-[10px] text-neutral-500">v{entry.version} · {installed ? active ? 'Added' : 'Installed' : `${Math.ceil(entry.size_bytes / 1024 / 1024)} MB download`}</p>
          </div>
        </div>
        <button type="button" onClick={() => void install(entry)} disabled={busyId !== null || (atLimit && !active)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.09] px-3 py-2.5 text-xs font-medium text-neutral-200 transition hover:bg-white/[0.14] disabled:opacity-40">
          <Download size={14} />{busyId === entry.id ? 'Installing…' : active ? 'Added to desktop' : installed ? 'Add Spirit' : 'Install Spirit'}
        </button>
      </article>;
    })}</div>}
    {error && <p role="alert" className="rounded-lg bg-neutral-500/10 p-3 text-xs text-neutral-300">{error}</p>}
  </section>;
}
