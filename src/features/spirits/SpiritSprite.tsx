import { useEffect, useRef, useState } from 'react';
import { loadSpiritSheet, spiritListeningStateStrip, spiritThinkingStrip, spiritTalkingFrames, spiritSocialFrames, spiritSpecialFrames, spiritListeningFrames } from './catalog';
import { CELL_HEIGHT, CELL_WIDTH, lookCell, LOOK_DIRECTIONS, poseConfig } from './model';
import type { SpiritPose } from './model';
import { SOCIAL_RENDER_ACTIONS, socialFrame, socialLooping } from './socialModel';
import type { PairPose } from './socialModel';

export function SpiritSprite({ id, version, size = 128, animation = 'idle', direction = null, resting = false, pair = null }: { id: string; version?: string; size?: number; animation?: SpiritPose; direction?: number | null; resting?: boolean; pair?: PairPose | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<{ id: string; image?: HTMLImageElement; error?: string }>();
  const [listeningState, setListeningState] = useState<{ id: string; image: HTMLImageElement; frames: number }>();
  const [thinking, setThinking] = useState<{ id: string; image: HTMLImageElement }>();
  const [talking, setTalking] = useState<{ id: string; frames: HTMLImageElement[] }>();
  const [socialImages, setSocialImages] = useState<Record<string, HTMLImageElement[]>>({});
  const [specialImages, setSpecialImages] = useState<Record<string, HTMLImageElement[]>>({});
  const [listeningImages, setListeningImages] = useState<{ id: string; strips: HTMLImageElement[] }>();
  useEffect(() => {
    let cancelled = false;
    void Promise.all((['pihu', 'piyu'] as const).flatMap(companion => SOCIAL_RENDER_ACTIONS.map(async action => {
      const urls = await spiritSocialFrames(action, companion);
      const frames = await Promise.all(urls.map(async url => { const frame = new Image(); frame.src = url; await frame.decode(); return frame; }));
      return [`${companion}:${action}`, frames] as const;
    }))).then(entries => { if (!cancelled) setSocialImages(Object.fromEntries(entries)); }).catch(console.error);
    return () => { cancelled = true; };
  }, [id, version]);
  useEffect(() => {
    let cancelled = false;
    const keys = ['pihu:jealous', 'piyu:jealous', 'pihu:turning', 'piyu:turning', 'pihu:mediating', 'pihu:reconcile'];
    void Promise.all(keys.map(async key => {
      const [who, action] = key.split(':');
      const urls = await spiritSpecialFrames(who, action as PairPose['action']);
      const frames = await Promise.all(urls.map(async url => { const frame = new Image(); frame.src = url; await frame.decode(); return frame; }));
      return [key, frames] as const;
    })).then(entries => { if (!cancelled) setSpecialImages(Object.fromEntries(entries)); }).catch(console.error);
    return () => { cancelled = true; };
  }, [id, version]);
  const image = source?.id === id ? source.image : undefined;
  const error = source?.id === id ? source.error : undefined;
  const hasLook = direction !== null && image?.naturalHeight === 2288;
  // Cursor updates must not restart the blink clock.
  const gaze = useRef<number | null>(null);
  useEffect(() => { gaze.current = hasLook ? direction : null; }, [hasLook, direction]);
  useEffect(() => {
    let cancelled = false;
    setListeningState(undefined);
    setThinking(undefined);
    setTalking(undefined);
    void spiritListeningStateStrip(id).then(url => {
      if (!url) return;
      const sprite = new Image(); sprite.src = url;
      return sprite.decode().then(() => { if (!cancelled && sprite.naturalWidth >= CELL_WIDTH * 6 && sprite.naturalWidth % CELL_WIDTH === 0 && sprite.naturalHeight === CELL_HEIGHT) setListeningState({ id, image: sprite, frames: sprite.naturalWidth / CELL_WIDTH }); });
    }).catch(console.error);
    void spiritThinkingStrip(id).then(url => {
      if (!url) return;
      const sprite = new Image(); sprite.src = url;
      return sprite.decode().then(() => { if (!cancelled) setThinking({ id, image: sprite }); });
    }).catch(console.error);
    void spiritTalkingFrames(id).then(urls => Promise.all(urls.map(async url => {
      const frame = new Image(); frame.src = url; await frame.decode(); return frame;
    }))).then(frames => { if (!cancelled) setTalking({ id, frames }); }).catch(console.error);
    let url = '';
    const image = new Image();
    image.onload = () => { if (!cancelled) setSource({ id, image }); };
    image.onerror = () => { if (!cancelled) setSource({ id, error: 'Artwork unavailable' }); };
    void loadSpiritSheet(id).then(source => {
      url = source;
      if (cancelled) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
      image.src = source;
    }).catch(() => { if (!cancelled) setSource({ id, error: 'Artwork unavailable' }); });
    return () => { cancelled = true; if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [id, version]);

  useEffect(() => {
    let cancelled = false;
    void spiritListeningFrames(id).then(urls => Promise.all(urls.map(async url => {
      const frame = new Image(); frame.src = url; await frame.decode(); return frame;
    }))).then(strips => {
      if (!cancelled && strips.length === 4 && strips.every(strip => strip.naturalWidth === CELL_WIDTH * 4 && strip.naturalHeight === CELL_HEIGHT)) {
        setListeningImages({ id, strips });
      }
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [id, version]);

  useEffect(() => {
    if (!image) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const config = animation === 'listening' && listeningState?.id === id ? { row: 0, frames: listeningState!.frames, fps: 8 } : animation === 'listening' && listeningImages?.id !== id ? poseConfig('waiting') : poseConfig(animation);
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      const context = canvas.current?.getContext('2d');
      if (!context) return;
      const cell = animation === 'idle' && frame === 0 && gaze.current !== null
        ? lookCell(gaze.current) : { row: config.row, column: frame };
      context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      const listeningSheet = animation === 'listening' && listeningState?.id === id ? listeningState.image : undefined;
      const thinkingSheet = animation === 'thinking' && thinking?.id === id ? thinking.image : undefined;
      const mouth = animation === 'speaking' && talking?.id === id ? talking.frames[frame % talking.frames.length] : undefined;
      const listeningFrame = animation === 'listening' && listeningImages?.id === id ? (motion.matches ? 12 : frame) : undefined;
      const listeningStrip = listeningFrame === undefined ? undefined : listeningImages!.strips[Math.floor(listeningFrame / 4)];
      const pairFrames = pair ? socialImages[`${pair.companion}:${pair.action}`] : undefined;
      const specialFrames = pair?.soloKey ? specialImages[pair.soloKey] : undefined;
      const specialImage = specialFrames?.[socialFrame(pair!.started, Date.now(), false, pair!.frameCount ?? specialFrames?.length ?? 4)];
      const pairImage = pairFrames?.[socialFrame(pair!.started, Date.now(), socialLooping(pair!.action), pair!.frameCount ?? pairFrames.length)];
      if (listeningSheet) context.drawImage(listeningSheet, (motion.matches ? Math.min(7, listeningState!.frames - 1) : frame % listeningState!.frames) * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      else if (listeningStrip && listeningFrame !== undefined) {
        context.drawImage(listeningStrip, (listeningFrame % 4) * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      } else if (specialImage && pair && !motion.matches) {
        context.drawImage(specialImage, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      } else if (pairImage && pair && !motion.matches) {
        context.save();
        if (pair.mirrored) { context.translate(CELL_WIDTH, 0); context.scale(-1, 1); }
        context.drawImage(pairImage, pair.column * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
        context.restore();
      } else if (thinkingSheet) context.drawImage(thinkingSheet, (frame % 6) * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      else if (mouth) context.drawImage(mouth, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      else context.drawImage(image, (animation === 'speaking' ? cell.column % 4 : cell.column) * CELL_WIDTH, cell.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      // Loop the full headphone, smooth blink, removal, and relaxed-hold sequence.
      frame = animation === 'listening' && listeningSheet ? (frame + 1) % listeningState!.frames : animation === 'listening' && frame >= 15 ? 12 : (frame + 1) % config.frames;
    };
    let idleHold = 0;
    const tick = () => {
      if (animation === 'idle' && frame === 1 && idleHold < 2400) {
        // Refresh the gaze during the open-eye pause, then play the blink row.
        frame = 0;
        idleHold += 1000 / config.fps;
      } else idleHold = 0;
      draw();
      const pairInterval = pair?.frameCount === 8 ? 850 : socialLooping(pair?.action ?? 'talking') ? 400 : 700;
      timer = setTimeout(tick, pair ? Math.max(16, pairInterval - ((Date.now() - pair.started) % pairInterval)) : 1000 / config.fps);
    };
    const start = () => {
      clearTimeout(timer);
      frame = animation === 'listening' && listeningState?.id === id && motion.matches ? Math.min(7, listeningState.frames - 1) : 0;
      idleHold = 0;
      draw();
      const pairInterval = pair?.frameCount === 8 ? 850 : socialLooping(pair?.action ?? 'talking') ? 400 : 700;
      if (!motion.matches && !resting) timer = setTimeout(tick, pair ? Math.max(16, pairInterval - ((Date.now() - pair.started) % pairInterval)) : 1000 / config.fps);
    };
    start();
    motion.addEventListener('change', start);
    return () => { clearTimeout(timer); motion.removeEventListener('change', start); };
  }, [image, animation, resting, listeningState, thinking, talking, id, pair, socialImages, specialImages, listeningImages]);
  return <>{error && <span role="alert" className="text-xs text-rose-300">{error}</span>}<canvas ref={canvas} width={CELL_WIDTH} height={CELL_HEIGHT} style={{ width: size, height: size * CELL_HEIGHT / CELL_WIDTH, display: error ? 'none' : 'block', pointerEvents: 'none' }} aria-label={`${hasLook ? `looking ${LOOK_DIRECTIONS[direction!]}` : animation} Spirit`} /></>;
}
