import React, { useEffect, useRef } from 'react';

export interface ThinkingOrbProps {
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  size?: number;
  className?: string;
}

export const ThinkingOrb: React.FC<ThinkingOrbProps> = ({
  state = 'idle',
  size = 28,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const render = () => {
      t += 0.04;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.35;

      // Color palettes based on state
      const colors = state === 'thinking'
        ? ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'] // Electric cyan-purple-pink gradient dots
        : state === 'listening'
        ? ['#f472b6', '#fb7185', '#fda4af', '#f43f5e'] // Soft pink ripple
        : state === 'speaking'
        ? ['#a7f3d0', '#34d399', '#38bdf8', '#818cf8'] // Emerald-cyan wave
        : ['#94a3b8', '#cbd5e1', '#e2e8f0', '#64748b']; // Subtle silver idle

      const particleCount = state === 'thinking' ? 14 : 10;

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + (state === 'thinking' ? t * 0.8 : t * 0.3);
        
        let r = baseRadius;
        if (state === 'thinking') {
          // Orbiting wobble wave
          r += Math.sin(angle * 3 + t * 2) * (size * 0.08);
        } else if (state === 'listening') {
          // Pulse expansion
          r += Math.sin(t * 1.5 + i) * (size * 0.06);
        } else if (state === 'speaking') {
          // Harmonic wave oscillation
          r += Math.cos(angle * 2 + t * 2.5) * (size * 0.07);
        } else {
          // Idle gentle breathe
          r += Math.sin(t + i) * (size * 0.02);
        }

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const dotRadius = state === 'thinking' ? (size * 0.065) + Math.sin(t * 2 + i) * 0.5 : (size * 0.05);

        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, dotRadius), 0, Math.PI * 2);
        ctx.fillStyle = colors[i % colors.length];
        ctx.shadowColor = colors[i % colors.length];
        ctx.shadowBlur = state === 'thinking' ? 6 : 3;
        ctx.fill();
      }

      // Draw central glowing core dot for thinking / speaking
      if (state === 'thinking' || state === 'speaking') {
        const coreRadius = Math.max(2, size * 0.08 + Math.sin(t * 2) * 0.8);
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = state === 'thinking' ? '#c084fc' : '#34d399';
        ctx.shadowColor = state === 'thinking' ? '#c084fc' : '#34d399';
        ctx.shadowBlur = 8;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};
