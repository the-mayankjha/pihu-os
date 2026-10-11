import { useEffect, useRef } from 'react';

export function SpiritMarketPreview({ name, src }: { name: string; src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const target = canvas.current;
    const context = target?.getContext('2d');
    if (!target || !context) return;

    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let frame = 0;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;

    image.decode().then(() => {
      if (disposed) return;
      const draw = () => {
        context.clearRect(0, 0, target.width, target.height);
        context.drawImage(image, (frame++ % 4) * 192, 0, 192, 208, 0, 0, target.width, target.height);
      };
      draw();
      timer = setInterval(draw, 260);
    }).catch(() => {
      if (!disposed) context.clearRect(0, 0, target.width, target.height);
    });

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
  }, [src]);

  return <canvas ref={canvas} width={192} height={208} className="h-28 w-24 object-contain" role="img" aria-label={`${name} animated Spirit preview`} />;
}
