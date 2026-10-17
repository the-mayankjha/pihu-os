import { useEffect, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, ArrowRight, ChevronRight, RefreshCw, ShoppingBag, Wrench } from 'lucide-react';
import { McpPackageControls, hasMcpUpdate, type InstalledMcp } from '../../features/marketplace/McpPackageControls';
import { openMcpMarket } from '../../core/services/mcpNavigation';

type Package = InstalledMcp & { display_name?: string; description?: string; tools?: string[]; transport?: string };
type Manifest = { display_name?: string; description?: string; version?: string; tools?: Array<{ name: string; description?: string }> };

export function InstalledMcpConnections({ selectedId, onSelect, renderConfiguration }: {
  selectedId: string | null; onSelect: (id: string | null) => void; renderConfiguration: (id: string) => ReactNode;
}) {
  const [catalog, setCatalog] = useState<Record<string, { version?: string; installable?: boolean }>>({});
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const selected = packages.find(item => item.id === selectedId);
  const [manifestRevision, setManifestRevision] = useState(0);
  const label = (item: Package) => item.display_name || item.id;
  async function refresh() {
    try {
      const items = await invoke<Package[]>('mcp_list_installed');
      setPackages(items);
      setManifestRevision(value => value + 1);
      const response = await fetch('https://pihu.nfks.co.in/api/v2/catalog?type=mcp&limit=100', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Could not check MCP updates.');
      const data = await response.json();
      setCatalog(Object.fromEntries((data.packages || []).map((item: { id: string }) => [item.id, item])));
      setError('');
    }
    catch (cause) { setError(String(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    window.addEventListener('pihu-configure-mcp', focus);
    return () => { window.removeEventListener('focus', focus); window.removeEventListener('pihu-configure-mcp', focus); };
  }, []);
  useEffect(() => {
    setManifest(null);
    if (!selectedId) return;
    const controller = new AbortController();
    void fetch(`https://pihu.nfks.co.in/api/v2/packages/${encodeURIComponent(selectedId)}/manifest`, { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : null).then(data => { if (!controller.signal.aborted) setManifest(data); }).catch(() => {});
    return () => controller.abort();
  }, [selectedId, manifestRevision]);
  async function operate(id: string, action: string, configuration?: Record<string, string>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = action === 'install' ? await invoke<string>('mcp_install_package', { packageId: id })
        : await invoke<string>('mcp_manage_package', { packageId: id, action, configuration: configuration ? Object.fromEntries(Object.entries(configuration).filter(([, value]) => value !== '')) : null });
      if (action === 'remove') onSelect(null);
      setNotice(action === 'install' || action === 'remove' ? result : `${action.charAt(0).toUpperCase() + action.slice(1)} complete`);
      await refresh();
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {selectedId ? <button onClick={() => onSelect(null)} className="inline-flex items-center gap-2 text-xs text-neutral-300 hover:text-white"><ArrowLeft size={14} />Installed MCPs</button> : <div><h3 className="text-sm font-semibold text-white">Your MCPs</h3><p className="mt-1 text-xs text-neutral-400">{packages.length} installed · select a package to configure it</p></div>}
      <div className="flex gap-3"><button onClick={() => { setLoading(true); void refresh(); }} aria-label="Refresh installed MCPs" className="text-neutral-400 hover:text-white"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button><button onClick={openMcpMarket} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-neutral-200 hover:bg-white/10"><ShoppingBag size={14} />Browse MCP Market<ArrowRight size={13} /></button></div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-400/5 p-3 text-xs text-red-200">{error}</p>}
    {notice && <p role="status" className="text-xs text-neutral-300">{notice}</p>}
    {loading && !packages.length ? <p className="py-8 text-center text-xs text-neutral-400">Loading installed packages…</p> : selected ? <>
      <header className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">{selected.bundled ? 'Built in to PIHU' : `Installed · v${selected.version || '—'}`}{!selected.bundled && hasMcpUpdate(selected.version, catalog[selected.id]?.version) && <span className="ml-3 text-amber-300">Update available · v{catalog[selected.id]?.version}</span>}</p><h3 className="mt-2 text-lg font-semibold text-white">{manifest?.display_name || label(selected)}</h3><p className="mt-2 text-xs leading-5 text-neutral-400">{manifest?.description || selected.description || 'Configure this MCP and manage its availability.'}</p></header>
      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><h4 className="text-xs font-semibold text-white">Configuration</h4><McpPackageControls key={selected.id} id={selected.id} version={catalog[selected.id]?.version || manifest?.version || selected.version} installed={selected} busy={busy} operate={operate} />
        {!selected.bundled && selected.enabled !== false ? renderConfiguration(selected.id) : selected.enabled === false ? <p className="text-xs text-neutral-400">Enable this MCP to configure its connection.</p> : null}
        {selected.id === 'browser-mcp' && <p className="text-xs leading-5 text-neutral-400">Browser automation uses installed Google Chrome. Open Chrome and use Diagnose to check the MCP protocol connection.</p>}
      </section>
      <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-xs text-neutral-300">Published tools · {manifest?.tools?.length ?? selected.tools?.length ?? 0}</summary><p className="mt-2 text-[11px] text-neutral-500">Definitions from the package manifest. Diagnose checks live tool discovery.</p><div className="mt-3 space-y-3">{manifest?.tools?.map(tool => <div key={tool.name} className="border-t border-white/5 pt-3"><p className="break-all font-mono text-xs text-neutral-200">{tool.name}</p><p className="mt-1 text-xs leading-5 text-neutral-400">{tool.description}</p></div>)}</div></details>
    </> : selectedId ? <p className="py-8 text-center text-xs text-neutral-400">This MCP is no longer installed. Browse the Market to install it.</p> : packages.length ? <div className="grid gap-3 md:grid-cols-2">{packages.map(item => <button key={item.id} onClick={() => onSelect(item.id)} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5 text-left transition hover:border-white/25 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/60">
      <div className="flex items-start justify-between gap-3"><Wrench size={19} className="text-neutral-300" /><span className={`text-[10px] ${item.enabled === false ? 'text-neutral-500' : item.status === 'error' ? 'text-amber-300' : 'text-neutral-300'}`}>{item.enabled === false ? 'Disabled' : (item.status || 'Configured').replaceAll('_', ' ')}</span></div>
      <h4 className="mt-4 text-sm font-semibold text-white">{label(item)}</h4><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-neutral-400">{item.description || (item.bundled ? 'Core PIHU tools included with the app.' : 'Installed MCP package. Open to configure its connection.')}</p>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px]"><span className="text-neutral-500">{item.bundled ? 'Built in' : `v${item.version || '—'}`}</span><span className="inline-flex items-center gap-1 text-neutral-300">{!item.bundled && hasMcpUpdate(item.version, catalog[item.id]?.version) ? <span className="text-amber-300">Update available · v{catalog[item.id]?.version}</span> : 'Configure'}<ChevronRight size={13} className="transition group-hover:translate-x-0.5" /></span></div>
    </button>)}</div> : <p className="py-8 text-center text-xs text-neutral-400">No MCP packages are installed. Browse the Market to get started.</p>}
  </section>;
}
