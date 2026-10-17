import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGoogleDocDraft } from '../../core/services/googleDocDraft';

export function GoogleDocPreview() {
  const { draft, setDraft } = useGoogleDocDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!draft) return null;
  async function upload() {
    if (!draft || busy) return;
    setBusy(true); setError('');
    try {
      const packages = await invoke<Array<{id: string; version?: string}>>('mcp_list_installed');
      const version = packages.find(item => item.id === 'google-workspace-mcp')?.version;
      if (!version || version.split('.').map(Number)[0] < 1 || (version.startsWith('1.0.'))) throw new Error('Update Google Workspace MCP to v1.1.0 or newer before uploading document content.');
      const raw = await invoke<string>('mcp_call_tool', { serverId: 'google-workspace-mcp', toolName: 'docs_create', arguments: {title: draft.title, content: draft.content} });
      let data = JSON.parse(raw);
      if (data.content) {
        const text = data.content.filter((item: {type: string}) => item.type === 'text').map((item: {text: string}) => item.text).join('\n');
        if (data.isError) throw new Error(text);
        data = JSON.parse(text);
      }
      if (data.error) {
        if (data.partial_document_id && data.doc_url) setDraft({...draft, documentId: data.partial_document_id, url: data.doc_url});
        throw new Error(`${data.error} ${data.message || ''}`);
      }
      if (!data.document_id || !data.doc_url) throw new Error('Google did not return a document link. Check the connection before retrying.');
      setDraft({...draft, documentId: data.document_id, url: data.doc_url});
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  }
  return <section className="mb-4 space-y-3 rounded-2xl border border-white/15 bg-black/20 p-4" onPointerDown={event => event.stopPropagation()}>
    <h3 className="text-sm font-semibold">Google Doc · {draft.url ? 'Created' : 'Editable draft'}</h3>
    <input aria-label="Document title" disabled={busy || !!draft.url} value={draft.title} onChange={event => setDraft({...draft, title: event.target.value})} className="w-full rounded-lg border border-white/15 bg-black/20 p-2 text-sm" />
    <textarea aria-label="Document content" disabled={busy || !!draft.url} value={draft.content} onChange={event => setDraft({...draft, content: event.target.value})} rows={14} className="w-full resize-y rounded-lg border border-white/15 bg-black/20 p-3 text-sm leading-6" />
    <details className="text-xs text-neutral-400"><summary>{draft.sources.length} source files · {draft.limited ? 'scan limit reached' : 'bounded project scan'}</summary>{draft.sources.map(path => <p key={path}>{path}</p>)}</details>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <div className="flex gap-3">{draft.url ? <a href={draft.url} target="_blank" rel="noreferrer" className="text-emerald-300">Open Google Doc ↗</a> : <button disabled={busy || !draft.title.trim() || !draft.content.trim()} onClick={() => void upload()} className="rounded-xl bg-white/15 px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Creating Google Doc…' : 'Create Google Doc'}</button>}<button disabled={busy} onClick={() => setDraft(null)} className="text-xs text-neutral-400">{draft.url ? 'Close' : 'Discard'}</button></div>
  </section>;
}
