import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, RefreshCw, Search, Sparkles, Wrench } from 'lucide-react';
import { SpiritMarket } from '../spirits/SpiritMarket';

const MCP_REGISTRY_URL = 'https://raw.githubusercontent.com/the-mayankjha/pihu_mcp/pihu_market/market/catalog.json';

type McpPackage = {
  type?: string;
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

function McpDetailsPage({ item, onBack, onInstall, onCopy, onConnections }: {
  item: McpPackage;
  onBack: () => void;
  onInstall: () => void;
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
      <div className="flex flex-wrap gap-2"><button type="button" onClick={onInstall} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-200"><Download size={13} />Install MCP</button><button type="button" onClick={onCopy} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">Copy install command</button></div>
    </header>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="text-sm font-semibold">Tools ({item.tool_count ?? item.tools_count ?? item.toolsProvided?.length ?? item.tools?.length ?? 0})</h3>{item.tools?.length ? <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{item.tools.map(tool => <div key={tool.name} className="rounded-xl border border-white/[0.07] bg-black/10 p-3"><p className="text-xs font-medium text-neutral-100">{tool.name}</p>{tool.description && <p className="mt-1 text-[11px] leading-5 text-neutral-400">{tool.description}</p>}</div>)}</div> : <p className="mt-3 text-xs text-neutral-400">Tool descriptions are not published for this package yet.</p>}</section>
      <aside className="space-y-4"><section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="text-sm font-semibold">Package details</h3><dl className="mt-3 space-y-2 text-xs">{[['Connection', item.connection || 'Available'], ['Status', item.status || '—'], ['Category', item.category || '—'], ['Runtime', runtime], ['Transport', transport], ['Entrypoint', item.installation?.entrypoint || '—']].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-white/[0.06] pb-2"><dt className="text-neutral-400">{label}</dt><dd className="text-right text-neutral-200">{value}</dd></div>)}</dl>{repository && <a className="mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white" href={repository} target="_blank" rel="noreferrer">Repository <ExternalLink size={12} /></a>}</section>
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
  const [selectedMcp, setSelectedMcp] = useState<McpPackage | null>(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(MCP_REGISTRY_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Registry request failed (${response.status}).`);
      const body = await response.json() as { packages?: McpPackage[]; results?: McpPackage[]; servers?: McpPackage[] } | McpPackage[];
      const entries = Array.isArray(body) ? body : body.packages || body.results || body.servers || [];
      setPackages(entries.filter(item => item && item.type === 'mcp' && typeof item.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(item.id)));
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

  async function install(item: McpPackage) {
    setNotice('');
    try {
      const result = await invoke<string>('mcp_install_package', { packageId: item.id });
      setNotice(result || `${displayName(item)} installed successfully.`);
      navigateTo('connections');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not start the MCP installer. Open Connections for setup options.');
    }
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
    onInstall={() => void install(selectedMcp)}
    onCopy={() => void copyInstallCommand(selectedMcp)}
    onConnections={() => navigateTo('connections')}
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
      {!loading && !error && filteredPackages.length > 0 && <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{filteredPackages.map(item => <article key={item.id} className="relative rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-white/20 hover:bg-white/[0.07]">
        <button type="button" aria-label={`Open ${displayName(item)} MCP details`} onClick={() => setSelectedMcp(item)} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300" />
        <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-white">{displayName(item)}</h3><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">Available</span></div><p className="mt-1 text-xs leading-5 text-neutral-400">{item.description || 'MCP package from the PIHU registry.'}</p></div><Wrench size={16} className="mt-1 shrink-0 text-neutral-400" /></div>
        <div className="pointer-events-none relative z-10 mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-500"><span>{authorName(item.author)}</span>{item.category && <span>{item.category}</span>}{item.runtime && <span>{typeof item.runtime === 'string' ? item.runtime : item.runtime.type}</span>}{item.version && <span>v{item.version}</span>}{(item.tool_count ?? item.tools_count ?? item.toolsProvided?.length ?? item.tools?.length) != null && <span>{item.tool_count ?? item.tools_count ?? item.toolsProvided?.length ?? item.tools?.length} tools</span>}</div>
        <div className="relative z-20 mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void install(item)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-200"><Download size={13} />Install MCP</button><button type="button" onClick={() => void copyInstallCommand(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5">Copy command</button><button type="button" onClick={() => navigateTo('connections')} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-neutral-300 hover:bg-white/5">Connections<ArrowRight size={13} /></button></div>
      </article>)}</div>}
    </>}

    {tab === 'spirits' && <><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div><h3 className="text-sm font-semibold">Animated Spirit companions</h3><p className="mt-1 text-xs text-neutral-400">Install artwork packages from the live Spirits registry.</p></div><button type="button" onClick={() => navigateTo('spirits')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5">Spirit settings<ArrowRight size={13} /></button></div><SpiritMarket /></>}

    {tab === 'skills' && <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center"><Sparkles size={22} className="text-neutral-400" /><h3 className="mt-3 text-sm font-semibold text-neutral-200">Skills are coming later</h3><p className="mt-1 max-w-sm text-xs leading-5 text-neutral-400">The marketplace will include installable PIHU Skills when the registry is ready.</p></div>}

    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs text-neutral-300"><Check size={14} className="mt-0.5 shrink-0 text-emerald-300" /><p className="min-w-0 flex-1 whitespace-pre-wrap">{notice}</p><button type="button" onClick={() => navigateTo(tab === 'spirits' ? 'spirits' : 'connections')} className="inline-flex shrink-0 items-center gap-1 text-neutral-200 hover:text-white">Open settings<ExternalLink size={12} /></button></div>}
  </section>;
}
