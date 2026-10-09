import { useEffect, useRef, useState } from 'react';
import { loadSpiritSheet, spiritTalkingFrames, spiritSocialFrames } from './catalog';
import { CELL_HEIGHT, CELL_WIDTH, lookCell, LOOK_DIRECTIONS, poseConfig } from './model';
import type { SpiritPose } from './model';
import { SOCIAL_RENDER_ACTIONS, socialFrame, socialLooping } from './socialModel';
import type { PairPose } from './socialModel';

export function SpiritSprite({ id, size = 128, animation = 'idle', direction = null, resting = false, pair = null }: { id: string; size?: number; animation?: SpiritPose; direction?: number | null; resting?: boolean; pair?: PairPose | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<{ id: string; image?: HTMLImageElement; error?: string }>();
  const [talking, setTalking] = useState<{ id: string; frames: HTMLImageElement[] }>();
  const [socialImages, setSocialImages] = useState<Record<string, HTMLImageElement[]>>({});
  useEffect(() => {
    let cancelled = false;
    void Promise.all((['pihu', 'piyu'] as const).flatMap(companion => SOCIAL_RENDER_ACTIONS.map(async action => {
      const frames = await Promise.all(spiritSocialFrames(action, companion).map(async url => { const frame = new Image(); frame.src = url; await frame.decode(); return frame; }));
      return [`${companion}:${action}`, frames] as const;
    }))).then(entries => { if (!cancelled) setSocialImages(Object.fromEntries(entries)); }).catch(console.error);
    return () => { cancelled = true; };
  }, []);
  const image = source?.id === id ? source.image : undefined;
  const error = source?.id === id ? source.error : undefined;
  const hasLook = direction !== null && image?.naturalHeight === 2288;
  // Cursor updates must not restart the blink clock.
  const gaze = useRef<number | null>(null);
  useEffect(() => { gaze.current = hasLook ? direction : null; }, [hasLook, direction]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(spiritTalkingFrames(id).map(async url => {
      const frame = new Image(); frame.src = url; await frame.decode(); return frame;
    })).then(frames => { if (!cancelled) setTalking({ id, frames }); }).catch(console.error);
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
  }, [id]);

  useEffect(() => {
    if (!image) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const config = poseConfig(animation);
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      const context = canvas.current?.getContext('2d');
      if (!context) return;
      const cell = animation === 'idle' && frame === 0 && gaze.current !== null
        ? lookCell(gaze.current) : { row: config.row, column: frame };
      context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      const mouth = animation === 'speaking' && talking?.id === id ? talking.frames[frame % talking.frames.length] : undefined;
      const pairFrames = pair ? socialImages[`${pair.companion}:${pair.action}`] : undefined;
      const pairImage = pairFrames?.[socialFrame(pair!.started, Date.now(), socialLooping(pair!.action))];
      if (pairImage && pair && !motion.matches) {
        context.save();
        if (pair.mirrored) { context.translate(CELL_WIDTH, 0); context.scale(-1, 1); }
        context.drawImage(pairImage, pair.column * CELL_WIDTH, 0, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
        context.restore();
      } else if (mouth) context.drawImage(mouth, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      else context.drawImage(image, (animation === 'speaking' ? cell.column % 4 : cell.column) * CELL_WIDTH, cell.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      frame = (frame + 1) % config.frames;
    };
    let idleHold = 0;
    const tick = () => {
      if (animation === 'idle' && frame === 1 && idleHold < 2400) {
        // Refresh the gaze during the open-eye pause, then play the blink row.
        frame = 0;
        idleHold += 1000 / config.fps;
      } else idleHold = 0;
      draw();
      timer = setTimeout(tick, pair ? Math.max(16, (socialLooping(pair.action) ? 400 : 700) - ((Date.now() - pair.started) % (socialLooping(pair.action) ? 400 : 700))) : 1000 / config.fps);
    };
    const start = () => {
      clearTimeout(timer);
      frame = 0;
      idleHold = 0;
      draw();
      if (!motion.matches && !resting) timer = setTimeout(tick, pair ? Math.max(16, (socialLooping(pair.action) ? 400 : 700) - ((Date.now() - pair.started) % (socialLooping(pair.action) ? 400 : 700))) : 1000 / config.fps);
    };
    start();
    motion.addEventListener('change', start);
    return () => { clearTimeout(timer); motion.removeEventListener('change', start); };
  }, [image, animation, resting, talking, id, pair, socialImages]);
  return <>{error && <span role="alert" className="text-xs text-rose-300">{error}</span>}<canvas ref={canvas} width={CELL_WIDTH} height={CELL_HEIGHT} style={{ width: size, height: size * CELL_HEIGHT / CELL_WIDTH, display: error ? 'none' : 'block', pointerEvents: 'none' }} aria-label={`${hasLook ? `looking ${LOOK_DIRECTIONS[direction!]}` : animation} Spirit`} /></>;
}
