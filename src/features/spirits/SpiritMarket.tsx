import { useEffect, useState } from 'react';
import { Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { bundledSpirits, saveSpiritPackage } from './catalog';
import { downloadSpirit, loadSpiritDetails, loadSpiritRegistry } from './registry';
import type { SpiritDetails } from './registry';
import { SpiritDetailsPage } from './SpiritDetailsPage';
import { SpiritMarketPreview } from './SpiritMarketPreview';
import type { RegistrySpirit } from './registry';
import { useSpiritsStore } from './store';
import { SpiritSprite } from './SpiritSprite';
import { isTauri, invoke } from '@tauri-apps/api/core';

export function SpiritMarket({ onImport, importLabel = 'Import Spirit', importDisabled = false }: { onImport?: () => void; importLabel?: string; importDisabled?: boolean }) {
  const { activeIds, customSpirits, add, remove, importSpirit, setEnabled } = useSpiritsStore();
  const [packages, setPackages] = useState<RegistrySpirit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedSpirit, setSelectedSpirit] = useState<RegistrySpirit | null>(null);
  const [details, setDetails] = useState<SpiritDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const installedSpirits = [...bundledSpirits, ...customSpirits];
  const installedIds = new Set(installedSpirits.map(spirit => spirit.id));
  const atLimit = activeIds.length >= 12;

  async function refresh() {
    setLoading(true);
    setError('');
    try { setPackages(await loadSpiritRegistry()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the Spirits catalog.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function openDetails(entry: RegistrySpirit) {
    setSelectedSpirit(entry);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);
    try { setDetails(await loadSpiritDetails(entry.id)); }
    catch (cause) { setDetailsError(cause instanceof Error ? cause.message : 'Could not load Spirit details.'); }
    finally { setDetailsLoading(false); }
  }

  async function install(entry: RegistrySpirit) {
    setError('');
    const current = customSpirits.find(spirit => spirit.id === entry.id) ?? bundledSpirits.find(spirit => spirit.id === entry.id);
      const updateAvailable = Boolean(current?.version && current.version !== entry.version);
    if (atLimit && !activeIds.includes(entry.id) && !updateAvailable) {
      setError('Remove a Spirit from the desktop before adding another.');
      return;
    }
    setBusyId(entry.id);
    try {
      if (installedIds.has(entry.id)) {
        if (updateAvailable) {
          const assets = await downloadSpirit(entry);
          await saveSpiritPackage(entry.id, assets);
          importSpirit({ id: entry.id, name: entry.name, description: entry.description, version: entry.version, author: entry.author, custom: true });
        } else add(entry.id);
      } else {
        const assets = await downloadSpirit(entry);
        await saveSpiritPackage(entry.id, assets);
        importSpirit({ id: entry.id, name: entry.name, description: entry.description, version: entry.version, author: entry.author, custom: true });
      }
      setEnabled(true);
      if (isTauri()) await invoke('refresh_spirit_windows');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not install ${entry.name}.`);
    } finally {
      setBusyId(null);
    }
  }

  if (selectedSpirit) return <SpiritDetailsPage
    name={selectedSpirit.name}
    details={details}
    loading={detailsLoading}
    error={detailsError}
    onBack={() => setSelectedSpirit(null)}
  />;

  const catalogById = new Map(packages.map(entry => [entry.id, entry]));
  const rows = [...packages.map(entry => ({ entry, spirit: customSpirits.find(item => item.id === entry.id) ?? bundledSpirits.find(item => item.id === entry.id) })),
    ...installedSpirits.filter(spirit => !catalogById.has(spirit.id)).map(spirit => ({ spirit, entry: undefined }))];

  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl space-y-5" aria-labelledby="spirit-market-title">
    <div className="flex items-center justify-between gap-3">
      <h4 id="spirit-market-title" className="text-lg font-semibold">Your Spirits <span className="text-neutral-500">{activeIds.length} added</span></h4>
      <div className="flex items-center gap-2">
        {onImport && <button type="button" onClick={onImport} disabled={importDisabled} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/15 disabled:opacity-40"><Upload size={16} />{importLabel}</button>}
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Spirit catalog" className="rounded-xl bg-white/10 p-2.5 disabled:opacity-50"><RefreshCw size={15} /></button>
      </div>
    </div>
    {installedIds.has('pihu') && installedIds.has('piyu') && <p className="text-sm text-neutral-400">Pihu and Piyu stay active together for their shared interactions.</p>}
    {loading && <p className="py-6 text-center text-xs text-neutral-400">Loading Spirit catalog…</p>}
    {!loading && rows.length === 0 && !error && <p className="py-6 text-center text-xs text-neutral-400">No Spirits are published or installed yet.</p>}
    {!loading && rows.length > 0 && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{rows.map(({ entry, spirit }) => {
      if (!spirit && !entry) return null;
      const id = spirit?.id ?? entry!.id;
      const name = spirit?.name ?? entry!.name;
      const description = spirit?.description ?? entry!.description;
      const installed = Boolean(spirit);
      const updateAvailable = Boolean(entry && spirit?.version && spirit.version !== entry.version);
      const active = activeIds.includes(id);
      const localOnly = !entry;
      return <article key={id} className="relative flex min-h-56 flex-col rounded-2xl border border-transparent bg-transparent p-4 transition hover:border-white/5 hover:bg-white/[0.025]">
        {entry && <button type="button" aria-label={`Open ${name} Spirit details`} onClick={() => void openDetails(entry)} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300" />}
        <div className="pointer-events-none relative z-10 flex min-h-32 items-start gap-4">
          <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-xl bg-white/[0.035] p-2">
            {installed ? <SpiritSprite id={id} version={spirit?.version} size={76} /> : <SpiritMarketPreview name={name} src={entry!.preview_url} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h5 className="truncate text-base font-semibold text-white">{name}</h5>{active && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200">On desktop</span>}</div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-neutral-400">{description}</p>
            <p className="mt-2 text-[11px] text-neutral-300">{spirit?.author ?? entry?.author ?? 'Imported on this computer'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px]">
              <span className="text-neutral-500">v{entry?.version ?? spirit?.version ?? 'local'}</span>
              {updateAvailable ? <span className="text-amber-300">· Update available</span>
                : installed ? <span className="text-emerald-300">· {active ? 'On desktop' : 'Installed'}</span>
                  : <span className="text-neutral-500">· {Math.ceil(entry!.size_bytes / 1024 / 1024)} MB download</span>}
            </div>
          </div>
        </div>
        <button type="button" onClick={() => {
          if (updateAvailable && entry) void install(entry);
          else if (active) remove(id);
          else if (installed) { if (atLimit) setError('Remove a Spirit from the desktop before adding another.'); else { add(id); setEnabled(true); } }
          else if (entry) void install(entry);
        }} disabled={busyId !== null || (atLimit && !active && !updateAvailable) || (localOnly && !installed)} className="relative z-20 mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.09] px-3 py-2.5 text-xs font-medium text-neutral-200 transition hover:bg-white/[0.14] disabled:opacity-40">
          {busyId === id ? <InstallProgress update={updateAvailable} /> : <>{installed && active && !updateAvailable ? <Trash2 size={14} /> : <Download size={14} />}{updateAvailable ? 'Update Spirit' : active ? 'Remove from desktop' : installed ? 'Add Spirit' : 'Install Spirit'}</>}
        </button>
      </article>;
    })}</div>}
    {error && <p role="alert" className="rounded-lg bg-neutral-500/10 p-3 text-xs text-neutral-300">{error}</p>}
  </section>;
}

function InstallProgress({ update }: { update: boolean }) {
  return <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
    <Download size={14} />{update ? 'Updating' : 'Installing'}
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2].map(index => <span key={index} className="inline-block animate-bounce" style={{ animationDelay: `${index * 120}ms` }}>·</span>)}
    </span>
  </span>;
}
