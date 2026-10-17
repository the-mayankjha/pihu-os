import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openMcpConfiguration } from '../../core/services/mcpNavigation';
import { listen } from '@tauri-apps/api/event';
import { CORE_MCP_IDS, hasMcpUpdate, McpPackageControls, type InstalledMcp } from './McpPackageControls';
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, RefreshCw, Search, Sparkles, Trash2, Wrench } from 'lucide-react';
import { SpiritMarket } from '../spirits/SpiritMarket';

const MCP_REGISTRY_URL = 'https://pihu.nfks.co.in/api/v2/catalog?type=mcp&limit=100';

type McpPackage = {
  type?: string;
  installable?: boolean;
  id: string;
  name: string;
  displayName?: string;
  display_name?: string;
  description?: string;
  author?: string | { name?: string };
  version?: string;
  category?: string;
  runtime?: string | { type?: string };
  transport?: string | { type?: string };
  tool_count?: number;
  tools_count?: number;
  toolsProvided?: string[];
  tools?: Array<{ name: string; description?: string }>;
  requirements?: string[];
  installation?: { type?: string; repository?: string; entrypoint?: string };
  repository?: { url?: string; branch?: string } | string;
  tags?: string[];
  status?: string;
  connection?: string;
  verified?: boolean;
};

type MarketTab = 'mcp' | 'spirits' | 'skills';

function displayName(item: McpPackage) {
  return item.displayName || item.display_name || item.name || item.id;
}

function authorName(author: McpPackage['author']) {
  return typeof author === 'string' ? author : author?.name || 'Community';
}

function McpDetailsPage({ item, onBack, controls, onCopy, onConnections }: {
  item: McpPackage;
  onBack: () => void;
  controls: ReactNode;
  onCopy: () => void;
  onConnections: () => void;
}) {
  const runtime = typeof item.runtime === 'string' ? item.runtime : item.runtime?.type || '—';
  const transport = typeof item.transport === 'string' ? item.transport : item.transport?.type || '—';
  const repository = typeof item.repository === 'string' ? item.repository : item.repository?.url || item.installation?.repository;
  return <section className="space-y-5" aria-label={`${displayName(item)} MCP details`}>
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400"><button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 hover:text-white"><ArrowLeft size={14} />Marketplace</button><span>›</span><button type="button" onClick={onBack} className="hover:text-white">MCPs</button><span>›</span><span className="text-white">{displayName(item)}</span></div>
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-5">
      <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{item.category || 'MCP'} · {transport}</p><h2 className="mt-2 text-xl font-semibold text-white">{displayName(item)}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">{item.description || 'MCP package from the PIHU registry.'}</p><p className="mt-3 text-xs text-neutral-400">{authorName(item.author)} · v{item.version || '—'} · {runtime} runtime</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{item.tags?.map(tag => <span key={tag} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] text-neutral-300">{tag}</span>)}</div>
      </div>
      <div className="flex flex-wrap gap-2">{controls}<button type="button" onClick={onCopy} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">Copy install command</button></div>
    </header>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="text-sm font-semibold">Tools ({item.tool_count ?? item.tools_count ?? item.toolsProvided?.length ?? item.tools?.length ?? 0})</h3>{item.tools?.length ? <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{item.tools.map(tool => <div key={tool.name} className="rounded-xl border border-white/[0.07] bg-black/10 p-3"><p className="text-xs font-medium text-neutral-100">{tool.name}</p>{tool.description && <p className="mt-1 text-[11px] leading-5 text-neutral-400">{tool.description}</p>}</div>)}</div> : <p className="mt-3 text-xs text-neutral-400">Tool descriptions are not published for this package yet.</p>}</section>
      <aside className="space-y-4"><section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="text-sm font-semibold">Package details</h3><dl className="mt-3 space-y-2 text-xs">{[['Author', authorName(item.author)], ['Version', item.version || '—'], ['Tools', String(item.tool_count ?? item.tools_count ?? item.toolsProvided?.length ?? item.tools?.length ?? 0)], ['Connection', item.connection || 'Available'], ['Status', item.status || '—'], ['Category', item.category || '—'], ['Runtime', runtime], ['Transport', transport], ['Entrypoint', item.installation?.entrypoint || '—']].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-white/[0.06] pb-2"><dt className="text-neutral-400">{label}</dt><dd className="text-right text-neutral-200">{value}</dd></div>)}</dl>{repository && <a className="mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white" href={repository} target="_blank" rel="noreferrer">Repository <ExternalLink size={12} /></a>}</section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="text-sm font-semibold">Requirements</h3>{item.requirements?.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-neutral-300">{item.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul> : <p className="mt-2 text-xs text-neutral-400">No additional requirements listed.</p>}<button type="button" onClick={onConnections} className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white">Connection settings <ArrowRight size={13} /></button></section></aside>
    </div>
  </section>;
}

export function Marketplace({ navigateTo }: { navigateTo: (category: 'connections' | 'spirits') => void }) {
  const [tab, setTab] = useState<MarketTab>('mcp');
  const [packages, setPackages] = useState<McpPackage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [installed, setInstalled] = useState<Record<string, InstalledMcp>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null);
  const [operationError, setOperationError] = useState('');
  const [selectedMcp, setSelectedMcp] = useState<McpPackage | null>(null);

  async function refreshInventory() {
    const items = await invoke<InstalledMcp[]>('mcp_list_installed');
    setInstalled(Object.fromEntries(items.map(item => [item.id, item])));
  }

  useEffect(() => {
    let disposed = false;
    const subscription = listen<{ packageId: string; message: string }>('mcp-package-progress', event => {
      if (!disposed) setProgress(value => ({ ...value, [event.payload.packageId]: event.payload.message }));
    });
    void refreshInventory().catch(cause => setOperationError(String(cause)));
    return () => { disposed = true; void subscription.then(unlisten => unlisten()); };
  }, []);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(MCP_REGISTRY_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Registry request failed (${response.status}).`);
      const body = await response.json() as { packages?: McpPackage[]; results?: McpPackage[]; servers?: McpPackage[] } | McpPackage[];
      const entries = Array.isArray(body) ? body : body.packages || body.results || body.servers || [];
      setPackages(entries.filter(item => item && !CORE_MCP_IDS.has(item.id) && item.type === 'mcp' && typeof item.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(item.id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the MCP catalog.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const filteredPackages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return packages;
    return packages.filter(item => [displayName(item), item.id, item.description, item.category, authorName(item.author)]
      .some(value => value?.toLowerCase().includes(query)));
  }, [packages, search]);

  async function operate(id: string, action: string, configuration?: Record<string, string>) {
    if (busy[id]) return;
    setBusy(value => ({ ...value, [id]: true }));
    setOperationError('');
    setNotice('');
    try {
      const result = action === 'install'
        ? await invoke<string>('mcp_install_package', { packageId: id })
        : await invoke<string>('mcp_manage_package', { packageId: id, action, configuration: configuration ? Object.fromEntries(Object.entries(configuration).filter(([, value]) => value !== '')) : null });
      setNotice(action === 'install' || action === 'remove' ? result : `${id}: ${action} complete`);
      await refreshInventory();
      if (action === 'install') openMcpConfiguration(id);
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(value => ({ ...value, [id]: false }));
      setProgress(value => ({ ...value, [id]: '' }));
    }
  }

  function controls(item: McpPackage) {
    return <McpPackageControls id={item.id} version={item.version} installed={installed[item.id]} busy={!!busy[item.id]} progress={progress[item.id]} installable={item.installable} operate={operate} />;
  }

  async function copyInstallCommand(item: McpPackage) {
    await navigator.clipboard.writeText(`pihu mcp install ${item.id}`);
    setNotice(`Copied: pihu mcp install ${item.id}`);
  }

  const tabs: { id: MarketTab; label: string }[] = [
    { id: 'mcp', label: 'MCPs' },
    { id: 'spirits', label: 'Spirits' },
    { id: 'skills', label: 'Skills · Future' },
  ];

  if (tab === 'mcp' && selectedMcp) return <McpDetailsPage
    item={selectedMcp}
    onBack={() => setSelectedMcp(null)}
    controls={<>{controls(selectedMcp)}{operationError && <p role="alert" className="text-xs text-red-300">{operationError}</p>}{notice && <p role="status" className="text-xs text-neutral-300">{notice}</p>}</>}
    onCopy={() => void copyInstallCommand(selectedMcp)}
    onConnections={() => openMcpConfiguration(selectedMcp.id)}
  />;

  return <section className="space-y-5" aria-label="PIHU Marketplace">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs uppercase tracking-[0.2em] text-neutral-400">PIHU MARKETPLACE</p><p className="mt-1 text-sm text-neutral-300">Browse packages, install them, and manage their settings.</p></div>
      {tab === 'mcp' && <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-200 hover:bg-white/10 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh catalog</button>}
    </div>

    <div className="flex gap-2 border-b border-white/10 pb-3" role="tablist" aria-label="Marketplace package types">
      {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setNotice(''); }} className={`rounded-xl px-4 py-2 text-xs font-medium transition ${tab === item.id ? 'bg-white/15 text-white ring-1 ring-white/15' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}>{item.label}</button>)}
    </div>

    {tab === 'mcp' && <>
      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-neutral-400"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search MCPs, tools, publishers…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" aria-label="Search MCP catalog" /></label>
      {loading && <p className="py-8 text-center text-sm text-neutral-400">Loading the MCP registry…</p>}
      {!loading && error && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-neutral-300"><p>{error}</p><button type="button" onClick={() => void refresh()} className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs">Try again</button></div>}
      {!loading && !error && filteredPackages.length === 0 && <p className="py-8 text-center text-sm text-neutral-400">{packages.length ? 'No MCPs match your search.' : 'No MCPs are currently available.'}</p>}
      {!loading && !error && filteredPackages.length > 0 && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{filteredPackages.map(item => {
        const local = installed[item.id];
        const working = !!busy[item.id];
        const updateAvailable = !!local && item.installable !== false && hasMcpUpdate(local.version, item.version);
        const count = item.tool_count ?? item.tools_count ?? item.toolsProvided?.length ?? item.tools?.length;
        return <article key={item.id} className="group flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.025] to-transparent p-5 transition hover:border-white/25">
          <div className="flex items-start justify-between gap-3"><Wrench size={21} strokeWidth={1.6} className="text-neutral-200" /><span className={`text-[10px] ${local ? 'text-emerald-300' : item.installable === false ? 'text-neutral-500' : 'text-neutral-400'}`}>{local ? 'Installed' : item.installable === false ? 'Coming soon' : 'Available to download'}</span></div>
          <button onClick={() => setSelectedMcp(item)} className="mt-5 text-left focus-visible:outline-none focus-visible:underline"><p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">{item.category || 'Integration'}</p><h3 className="mt-1 text-base font-semibold tracking-tight text-white">{displayName(item)}</h3></button>
          <p className="mt-2 min-h-12 text-xs leading-6 text-neutral-400">{item.description || 'Extend PIHU with tools from this MCP.'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500"><span className="w-full text-xs font-medium text-neutral-300">{authorName(item.author)}</span><span>v{local?.version || item.version || '—'}</span>{count != null && <span>{count} tools</span>}{updateAvailable && <span className="font-medium text-amber-300">· Update available · v{item.version}</span>}</div>
          <div className="mt-5 flex items-stretch gap-2.5 border-t border-white/10 pt-4">
            <button onClick={() => local && !updateAvailable ? openMcpConfiguration(item.id) : void operate(item.id, 'install')} disabled={working || (!local && item.installable === false)} className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white/[0.12] px-4 py-3 text-sm font-semibold text-neutral-200 backdrop-blur-lg transition hover:bg-white/[0.18] disabled:opacity-40">{working ? <RefreshCw size={14} className="animate-spin" /> : local && !updateAvailable ? <Wrench size={14} /> : <Download size={14} />}{working ? 'Working…' : updateAvailable ? 'Update MCP' : local ? 'Configure' : item.installable === false ? 'Not published' : 'Install MCP'}</button>
            {local && <button onClick={() => setRemoveCandidate(item.id)} disabled={working} aria-label={`Uninstall ${displayName(item)}`} title="Uninstall MCP" className="inline-flex min-h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.025] text-neutral-400 transition hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-40"><Trash2 size={18} strokeWidth={1.7} /></button>}
          </div>
          {removeCandidate === item.id && <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs text-neutral-300"><p>Remove {displayName(item)} and its installed package files?</p><div className="mt-3 flex gap-3"><button onClick={() => { setRemoveCandidate(null); void operate(item.id, 'remove'); }} disabled={working} className="text-red-300 hover:text-red-200">Remove MCP</button><button onClick={() => setRemoveCandidate(null)} className="text-neutral-400 hover:text-white">Cancel</button></div></div>}
          {working && <p role="status" className="mt-3 text-[11px] text-neutral-400">{progress[item.id] || 'Preparing package…'}</p>}
        </article>;
      })}</div>}
    </>}

    {tab === 'spirits' && <><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div><h3 className="text-sm font-semibold">Animated Spirit companions</h3><p className="mt-1 text-xs text-neutral-400">Install artwork packages from the live Spirits registry.</p></div><button type="button" onClick={() => navigateTo('spirits')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">Spirit settings<ArrowRight size={13} /></button></div><SpiritMarket /></>}

    {tab === 'skills' && <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center"><Sparkles size={22} className="text-neutral-400" /><h3 className="mt-3 text-sm font-semibold text-neutral-200">Skills are coming later</h3><p className="mt-1 max-w-sm text-xs leading-5 text-neutral-400">The marketplace will include installable PIHU Skills when the registry is ready.</p></div>}

    {operationError && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-400/5 p-3 text-xs text-red-200">{operationError}</p>}
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs text-neutral-300"><Check size={14} className="mt-0.5 shrink-0 text-emerald-300" /><p className="min-w-0 flex-1 whitespace-pre-wrap">{notice}</p><button type="button" onClick={() => navigateTo(tab === 'spirits' ? 'spirits' : 'connections')} className="inline-flex shrink-0 items-center gap-1 text-neutral-200 hover:text-white">Open settings<ExternalLink size={12} /></button></div>}
  </section>;
}
