import { useEffect, useRef, useState } from 'react';
import { loadSpiritSheet } from './catalog';
import { ANIMATIONS, CELL_HEIGHT, CELL_WIDTH, lookCell, LOOK_DIRECTIONS } from './model';
import type { SpiritAnimation } from './model';

export function SpiritSprite({ id, size = 128, animation = 'idle', direction = null, resting = false }: { id: string; size?: number; animation?: SpiritAnimation; direction?: number | null; resting?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<{ id: string; image?: HTMLImageElement; error?: string }>();
  const image = source?.id === id ? source.image : undefined;
  const error = source?.id === id ? source.error : undefined;
  const hasLook = direction !== null && image?.naturalHeight === 2288;
  // Cursor updates must not restart the blink clock.
  const gaze = useRef<number | null>(null);
  useEffect(() => { gaze.current = hasLook ? direction : null; }, [hasLook, direction]);
  useEffect(() => {
    let cancelled = false;
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
    const config = ANIMATIONS[animation];
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      const context = canvas.current?.getContext('2d');
      if (!context) return;
      const cell = animation === 'idle' && frame === 0 && gaze.current !== null
        ? lookCell(gaze.current) : { row: config.row, column: frame };
      context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      context.drawImage(image, cell.column * CELL_WIDTH, cell.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
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
      timer = setTimeout(tick, 1000 / config.fps);
    };
    const start = () => {
      clearTimeout(timer);
      frame = 0;
      idleHold = 0;
      draw();
      if (!motion.matches && !resting) timer = setTimeout(tick, 1000 / config.fps);
    };
    start();
    motion.addEventListener('change', start);
    return () => { clearTimeout(timer); motion.removeEventListener('change', start); };
  }, [image, animation, resting]);
  return <>{error && <span role="alert" className="text-xs text-rose-300">{error}</span>}<canvas ref={canvas} width={CELL_WIDTH} height={CELL_HEIGHT} style={{ width: size, height: size * CELL_HEIGHT / CELL_WIDTH, display: error ? 'none' : 'block', pointerEvents: 'none' }} aria-label={`${hasLook ? `looking ${LOOK_DIRECTIONS[direction!]}` : animation} Spirit`} /></>;
}
