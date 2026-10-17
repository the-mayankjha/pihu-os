import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { SpiritDetails } from './registry';
import { SpiritMarketPreview } from './SpiritMarketPreview';

const prettySize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function SpiritDetailsPage({ name, details, loading, error, onBack }: {
  name: string;
  details: SpiritDetails | null;
  loading: boolean;
  error: string;
  onBack: () => void;
}) {
  const rawAnimations = details?.manifest.animations;
  const packagedAnimations = rawAnimations && typeof rawAnimations === 'object' && !Array.isArray(rawAnimations)
    ? Object.entries(rawAnimations).filter((entry): entry is [string, { path: string; frames: number; fps: number; trigger: string }] => {
      const animation = entry[1];
      return Boolean(animation && typeof animation === 'object'
        && typeof (animation as { path?: unknown }).path === 'string'
        && Number.isFinite((animation as { frames?: unknown }).frames)
        && Number.isFinite((animation as { fps?: unknown }).fps)
        && typeof (animation as { trigger?: unknown }).trigger === 'string');
    })
    : [];
  return <section aria-labelledby="spirit-details-title" className="mx-auto w-full max-w-5xl space-y-5 text-neutral-100">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400"><button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 hover:text-white"><ArrowLeft size={14} /> Marketplace</button><span>›</span><button type="button" onClick={onBack} className="hover:text-white">Spirits</button><span>›</span><span id="spirit-details-title" className="text-neutral-100">{name}</span></div>
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
        <div><h2 className="text-lg font-semibold">{name}</h2><p className="text-xs text-neutral-400">Spirit details and animation contract</p></div>
        <button type="button" onClick={onBack} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">Back to Spirits</button>
      </header>
      <div className="max-h-[calc(88vh-130px)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        {loading && <p className="py-12 text-center text-sm text-neutral-400">Loading details from the PIHU Market API…</p>}
        {!loading && error && <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-sm text-red-100">{error}</p>}
        {!loading && details && <div className="space-y-6">
          <div className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex h-32 w-28 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] p-2"><SpiritMarketPreview name={name} src={details.preview_url} /></div>
            <div className="min-w-0 space-y-1 text-sm">
              <h3 className="font-semibold">{String(details.package.display_name ?? name)}</h3>
              <p className="text-neutral-300">{String(details.manifest.description ?? '')}</p>
              <p className="text-xs text-neutral-400">Author: {String(details.manifest.author ?? 'Unknown')} · Version {String(details.manifest.version ?? '')}</p>
              <p className="text-xs text-neutral-400">ID: {String(details.manifest.id ?? '')} · Category: {String(details.manifest.category ?? 'Spirits')}</p>
              {Array.isArray(details.manifest.tags) && <p className="text-xs text-neutral-500">Tags: {(details.manifest.tags as string[]).join(', ')}</p>}
              {Array.isArray(details.manifest.supported_features) && <p className="text-xs text-neutral-500">Features: {(details.manifest.supported_features as string[]).join(', ')}</p>}
              <a className="inline-flex items-center gap-1 pt-1 text-xs text-pink-200 hover:text-pink-100" href={details.download_url} target="_blank" rel="noreferrer">Package API <ExternalLink size={12} /></a>
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Packaged animation strips</h3>
            {packagedAnimations.length ? <div className="grid gap-2 sm:grid-cols-2">{packagedAnimations.map(([id, animation]) => <div key={id} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs"><div className="font-medium text-neutral-200">{id.replaceAll('_', ' ')}</div><div className="mt-1 text-neutral-400">{animation.path} · {animation.frames} frames · {animation.fps} fps · {animation.trigger}</div></div>)}</div> : <p className="text-xs text-neutral-500">No extra animation strips are published for this Spirit.</p>}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Sprite sheet format</h3>
            <p className="text-xs text-neutral-400">{details.animation.sheet?.width} px wide · {details.animation.sheet?.heights?.join(' or ')} px high · {details.animation.cell?.width} × {details.animation.cell?.height} px cells</p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[420px] text-left text-xs"><thead className="bg-white/[0.05] text-neutral-400"><tr><th className="px-3 py-2">Animation</th><th className="px-3 py-2">Atlas row</th><th className="px-3 py-2">Frames</th><th className="px-3 py-2">Speed</th></tr></thead>
                <tbody>{details.animation.animations?.map(animation => <tr key={animation.id} className="border-t border-white/[0.07]"><td className="px-3 py-2">{animation.label} <span className="text-neutral-500">({animation.id})</span></td><td className="px-3 py-2">{animation.row}</td><td className="px-3 py-2">{animation.frames}</td><td className="px-3 py-2">{animation.fps} fps</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Special poses and runtime state mapping</h3>
            <div className="space-y-2">{details.animation.special_poses?.map(pose => <div key={pose.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs"><span>{pose.id}{pose.source ? ` · based on ${pose.source}` : ''}</span><span className="text-neutral-400">row {pose.row} · {pose.frames} frames · {pose.fps} fps{pose.assets ? ` · ${pose.assets}` : ''}</span></div>)}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(details.animation.state_mapping ?? {}).map(([state, animation]) => <div key={state} className="flex justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs"><span className="text-neutral-300">{state}</span><span className="text-pink-200">{animation}</span></div>)}</div>
            <div className="mt-3 space-y-2">{details.animation.activity_rules?.map((rule, index) => <p key={index} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-neutral-300"><span className="text-neutral-500">When {rule.when}:</span> {rule.animation}</p>)}</div>
            <div className="mt-3 space-y-2">{details.animation.idle_rules?.map((rule, index) => <p key={index} className="rounded-lg bg-white/[0.035] px-3 py-2 text-xs text-neutral-400">{Object.entries(rule).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' · ')}</p>)}</div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div><h3 className="mb-2 text-sm font-semibold">Interactions</h3><div className="flex flex-wrap gap-1.5">{details.animation.interactions?.map(action => <span key={action} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px]">{action}</span>)}</div><p className="mt-2 text-[11px] text-neutral-500">Social timing: {Object.entries(details.animation.social_timing_ms ?? {}).map(([key, value]) => `${key} ${value} ms`).join(' · ')}</p></div>
            <div><h3 className="mb-2 text-sm font-semibold">Published assets ({details.assets.length})</h3><div className="max-h-48 space-y-1 overflow-y-auto">{details.assets.map(asset => <a key={asset.path} href={asset.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-2.5 py-2 text-[10px] hover:bg-white/[0.08]"><span className="truncate">{asset.path}</span><span className="shrink-0 text-neutral-500">{prettySize(asset.size_bytes)}</span></a>)}</div></div>
          </section>
        </div>}
      </div>
    </section>;
}
