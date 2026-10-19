import ReactMarkdown from 'react-markdown';
import { Download, RefreshCw, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { useAppUpdates, checkAppUpdates, installAppUpdate, restartForUpdate } from './appUpdates';
const size = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
export function SoftwareUpdate() {
  const state = useAppUpdates();
  const busy = ['checking','downloading','installing'].includes(state.phase);
  const progress = state.total ? Math.min(100, state.bytes / state.total * 100) : null;
  const title = state.phase === 'available' ? `PIHU ${state.version} is available` : state.phase === 'current' ? 'PIHU is up to date' : state.phase === 'ready' ? 'Ready to restart' : state.phase === 'downloading' ? 'Downloading update' : state.phase === 'installing' ? 'Installing update' : 'Software Update';
  return <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6" aria-label="Software Update">
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="rounded-2xl bg-pink-400/10 p-3 text-pink-200"><ArrowUpCircle size={25}/></div><div><p className="text-[10px] uppercase tracking-[.2em] text-neutral-400">Software Update</p><h3 className="mt-1 text-lg font-semibold text-white">{title}</h3></div></div>
    <button disabled={busy} onClick={() => void (state.phase === 'available' ? installAppUpdate() : state.phase === 'ready' ? restartForUpdate() : checkAppUpdates())} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50">{busy ? <RefreshCw size={16} className="animate-spin"/> : state.phase === 'current' ? <CheckCircle2 size={16}/> : <Download size={16}/>} {state.phase === 'checking' ? 'Checking…' : state.phase === 'downloading' ? 'Downloading…' : state.phase === 'installing' ? 'Installing…' : state.phase === 'ready' ? 'Restart PIHU' : state.phase === 'available' ? 'Download & install' : state.phase === 'error' ? 'Retry' : 'Check now'}</button></div>
    <p role="status" className="mt-4 text-xs text-neutral-400">{state.phase === 'downloading' ? `${size(state.bytes)}${state.total ? ` of ${size(state.total)} · ${progress?.toFixed(0)}%` : ' downloaded'}` : state.phase === 'installing' ? 'Applying the signed update. Keep PIHU open.' : state.phase === 'ready' ? 'Restart when you are ready to use the new version.' : state.checkedAt ? `Last checked ${new Date(state.checkedAt).toLocaleTimeString()} · Updates are checked when PIHU opens.` : 'PIHU checks for updates at startup. You choose when to install.'}</p>
    {state.phase === 'downloading' && <progress className="mt-3 h-2 w-full accent-pink-300" max={100} value={progress ?? undefined} aria-label="Update download"/>}
    {state.error && <p role="alert" className="mt-3 break-words text-sm text-rose-300">{state.error}</p>}
    {state.notes && <details className="release-notes mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/[0.08] text-neutral-200">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60">What’s new <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-neutral-300">v{state.version}</span></summary>
      <div className="max-h-80 overflow-y-auto border-t border-white/10 px-5 py-4">
        <ReactMarkdown skipHtml components={{
          h1: ({children}) => <h4 className="mb-4 text-base font-semibold leading-6 text-white">{children}</h4>,
          h2: ({children}) => <h5 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-white first:mt-0">{children}</h5>,
          h3: ({children}) => <h6 className="mb-2 mt-4 text-sm font-medium text-white">{children}</h6>,
          p: ({children}) => <p className="my-2 text-xs leading-6 text-neutral-300">{children}</p>,
          ul: ({children}) => <ul className="list-disc space-y-2 pl-4 text-xs leading-6 text-neutral-300 marker:text-pink-200/70">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal space-y-2 pl-4 text-xs leading-6 text-neutral-300">{children}</ol>,
          code: ({children}) => <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-pink-100">{children}</code>,
          a: ({children, href}) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-white">{children}</a>,
        }}>{state.notes}</ReactMarkdown>
      </div>
    </details>}
    <a href="https://github.com/the-mayankjha/pihu-os/releases/latest" target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-neutral-400 underline">View releases and manual downloads</a>
  </section>;
}
export function UpdatePrompt() {
  const {prompt, version} = useAppUpdates();
  if (!prompt) return null;
  return <div role="dialog" aria-label="PIHU update available" className="fixed bottom-8 right-8 z-[9999] w-80 rounded-3xl border border-white/15 bg-neutral-900 p-5 text-white shadow-2xl"><h3 className="font-semibold">PIHU {version} is ready to download</h3><p className="mt-2 text-sm text-neutral-400">Review the release and update when you’re ready. You can also ask “check PIHU updates”.</p><div className="mt-4 flex gap-3"><button className="rounded-xl bg-white/10 px-4 py-2" onClick={async () => {useAppUpdates.setState({prompt:false});const {openUpdates}=await import('./appUpdates');openUpdates();}}>Review update</button><button className="px-3 py-2 text-neutral-400" onClick={() => useAppUpdates.setState({prompt:false})}>Later</button></div></div>;
}
