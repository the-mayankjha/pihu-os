import { Activity, Cpu, Mic, Volume2 } from 'lucide-react';
import { useDiagnosticsStore } from '../../core/voice/diagnosis/EngineDiagnostics';
import { useVoiceStore } from '../../stores/voiceStore';

export function EngineDiagnosticsSummary() {
  const diagnostics = useDiagnosticsStore();
  const listening = useVoiceStore(state => state.isListening);
  const checked = diagnostics.lastDiagnosedAt !== null;
  const stt = diagnostics.stt.activeEngine === 'whisper' ? diagnostics.stt.whisper : diagnostics.stt.geminiLive;
  const tts = diagnostics.tts[diagnostics.tts.activeEngine === 'elevenlabs' ? 'elevenLabs' : diagnostics.tts.activeEngine];
  const inventory = diagnostics.mcpInventory;
  const enabled = inventory?.filter(item => item.enabled !== false).length ?? 0;
  const broken = inventory?.filter(item => item.status === 'error').length ?? 0;
  const cards = [
    { title: 'Wake-word engine', Icon: Cpu, online: diagnostics.wakeWord.online, status: diagnostics.wakeWord.online ? 'Ready' : 'Not running', detail: `${diagnostics.wakeWord.modelsCount} available model files · microphone listener`, error: diagnostics.wakeWord.error },
    { title: 'Speech recognition', Icon: Mic, online: stt.online, status: stt.online ? (listening ? 'Listening' : 'Ready') : 'Offline', detail: `${stt.name}${stt.latencyMs !== null ? ` · ${stt.latencyMs} ms` : ''}`, error: diagnostics.stt.error || stt.error },
    { title: 'Speech synthesis', Icon: Volume2, online: tts.online, status: tts.online ? (diagnostics.tts.isFallback ? 'Fallback active' : 'Ready') : 'Unavailable', detail: `${tts.name}${tts.latencyMs !== null ? ` · ${tts.latencyMs} ms` : ''}`, error: diagnostics.tts.error || tts.error },
    { title: 'MCP packages', Icon: Activity, online: inventory !== null && broken === 0, status: inventory === null ? 'Unavailable' : broken ? `${broken} need attention` : `${enabled} enabled`, detail: inventory ? `${inventory.filter(item => item.bundled).length} built in · ${inventory.filter(item => !item.bundled).length} downloaded` : 'Package inventory could not be read', error: null },
  ];
  return <div className="space-y-4">
    <p className="text-[11px] text-neutral-400" role="status">{checked ? `Last checked ${new Date(diagnostics.lastDiagnosedAt!).toLocaleTimeString()} · refreshes every minute while this section is open` : 'Waiting for the first diagnosis…'}{diagnostics.isDiagnosing && checked ? ' · Updating…' : ''}</p>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{cards.map(({ title, Icon, online, status, detail, error }) => <section key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Icon size={18} className="shrink-0 text-neutral-400" /><h4 className="text-xs font-semibold text-white">{title}</h4></div><span className={`shrink-0 text-[11px] font-medium ${!checked ? 'text-neutral-400' : online ? 'text-emerald-300' : 'text-amber-300'}`}>{checked ? status : 'Not checked'}</span></div>
      <p className="mt-2 text-[11px] leading-5 text-neutral-400">{checked ? detail : 'Readiness has not been measured yet.'}</p>
      {checked && error && <p className="mt-2 break-words text-[11px] text-amber-200">{error}</p>}
    </section>)}</div>
    {checked && <section className="rounded-2xl border border-white/10 p-4"><h4 className="text-xs font-semibold text-white">Speech provider checks</h4><div className="mt-3 space-y-3">{[diagnostics.tts.kokoro, diagnostics.tts.sarvam].map(provider => <div key={provider.name}><div className="flex justify-between gap-3 text-[11px]"><span className="text-neutral-300">{provider.name}</span><span className={provider.online ? 'text-emerald-300' : 'text-amber-300'}>{provider.statusText}</span></div>{provider.error && <p className="mt-1 break-words text-[11px] text-amber-200">{provider.error}</p>}</div>)}</div></section>}
    {diagnostics.bundle && <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold text-white">{diagnostics.bundle.mode === 'development' ? 'Development runtime' : 'Release runtime'}</h4><span className={`text-[11px] ${diagnostics.bundle.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{diagnostics.bundle.ok ? 'Dependencies available' : 'Needs attention'}</span></div>
      <dl className="mt-3 space-y-2 text-[11px]"><div className="flex flex-wrap justify-between gap-2"><dt className="text-neutral-400">Python {diagnostics.bundle.python?.version || ''}</dt><dd className="max-w-full break-all font-mono text-neutral-200">{diagnostics.bundle.python?.executable || diagnostics.bundle.checks.find(item => item.name === 'Python runtime')?.detail || 'Unavailable'}</dd></div><div className="flex justify-between gap-2"><dt className="text-neutral-400">Node</dt><dd className="font-mono text-neutral-200">{diagnostics.bundle.checks.find(item => item.name === 'Node runtime')?.detail || 'Unavailable'}</dd></div></dl>
      <details className="mt-4 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs text-neutral-300">Component checks · {diagnostics.bundle.checks.filter(item => item.ok).length}/{diagnostics.bundle.checks.length} available</summary><div className="mt-3 space-y-3">{diagnostics.bundle.checks.map(item => <div key={item.name}><p className={`text-[11px] ${item.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{item.ok ? '✓' : '×'} {item.name}</p><p className="mt-1 break-all text-[11px] text-neutral-500">{item.detail}</p></div>)}</div></details>
    </section>}
    {inventory && <details className="rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-xs text-neutral-300">MCP inventory · {inventory.length} configured</summary><p className="mt-2 text-[11px] text-neutral-500">Use Marketplace → Diagnose for a live MCP handshake. Enabled packages are not necessarily connected.</p><div className="mt-3 space-y-2">{inventory.map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-2 text-[11px]"><span className="text-neutral-300">{item.id}{item.version ? ` · ${item.version}` : ''}</span><span className="text-neutral-400">{item.enabled === false ? 'Disabled' : (item.status || 'Configured').replaceAll('_', ' ')}</span></div>)}</div></details>}
  </div>;
}
