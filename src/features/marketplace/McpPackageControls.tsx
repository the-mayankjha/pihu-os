import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';

export const CORE_MCP_IDS = new Set(['pihu-file-mcp', 'pihu-system-mcp', 'pihu-project-mcp', 'pihu-web-search-mcp']);
export type InstalledMcp = {
  id: string; version?: string; enabled?: boolean; bundled?: boolean; status?: string;
  last_error?: string; account_state?: string; previous_version?: string; required_configuration?: string[];
};
export type McpOperation = (id: string, action: string, configuration?: Record<string, string>) => Promise<void>;

export function McpPackageControls({ id, version, installed, busy, progress, installable, operate }: {
  id: string; version?: string; installed?: InstalledMcp; busy: boolean; progress?: string; installable?: boolean; operate: McpOperation;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [configuration, setConfiguration] = useState<Record<string, string>>({});
  const [showSetup, setShowSetup] = useState(false);
  const core = CORE_MCP_IDS.has(id);
  const button = 'inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-neutral-200 hover:bg-white/10 disabled:opacity-40';
  const action = (name: string) => { void operate(id, name); };
  if (core) return <p className="text-xs text-emerald-200">Included with PIHU · updates with the app</p>;
  return <div className="w-full space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {busy ? <span role="status" className="inline-flex items-center gap-2 text-xs text-neutral-300"><LoaderCircle size={14} className="animate-spin" />{progress || 'Working…'}</span> : <>
        <button type="button" disabled={installable === false} className={button} onClick={() => action('install')}><Download size={14} />{installable === false ? 'Release not published' : installed ? (version && installed.version !== version ? `Update to ${version}` : 'Repair installation') : 'Install MCP'}</button>
        {installed && <>
          <button type="button" className={button} onClick={() => action(installed.enabled === false ? 'enable' : 'disable')}>{installed.enabled === false ? 'Enable' : 'Disable'}</button>
          <button type="button" className={button} onClick={() => action('diagnose')}>Diagnose</button>
          {!!installed.required_configuration?.length && <button type="button" className={button} onClick={() => setShowSetup(value => !value)}>Configure</button>}
          {installed.previous_version && <button type="button" className={button} onClick={() => action('rollback')}>Restore {installed.previous_version}</button>}
          <button type="button" className={`${button} text-red-300`} onClick={() => setConfirmRemove(true)}>Remove</button>
        </>}
      </>}
    </div>
    {installed && <p className="text-xs text-neutral-400">Installed {installed.version || ''} · {(installed.status || (installed.enabled === false ? 'disabled' : 'installed')).replaceAll('_', ' ')}{installed.account_state && installed.account_state !== 'not_required' && <span className="block mt-1">Account: {installed.account_state.replaceAll('_', ' ')}{installed.account_state === 'credentials_saved' ? ' (connection not verified)' : ''}</span>}{installed.last_error && <span className="block mt-1 text-red-300">{installed.last_error}</span>}</p>}
    {confirmRemove && <div className="space-y-2 rounded-xl border border-red-300/20 p-3 text-xs"><p>Remove this MCP and its installed package files?</p><div className="flex gap-2"><button type="button" className={button} disabled={busy} onClick={() => { setConfirmRemove(false); action('remove'); }}>Remove MCP</button><button type="button" className={button} onClick={() => setConfirmRemove(false)}>Cancel</button></div></div>}
    {showSetup && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void operate(id, 'configure', configuration).then(() => { setConfiguration({}); setShowSetup(false); }); }}>
      {installed?.required_configuration?.map(name => <label key={name} className="block text-xs text-neutral-400">{name}<input type="password" autoComplete="off" value={configuration[name] || ''} onChange={event => setConfiguration(value => ({ ...value, [name]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-white/15 bg-black/20 p-2 text-white" placeholder="Leave empty to retain saved value" /></label>)}
      <button type="submit" disabled={busy} className={button}>Save configuration</button>
    </form>}
  </div>;
}
