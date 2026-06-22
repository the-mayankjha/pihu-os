import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface MiniAreaChartProps {
  data: number[]; // 0 to 100
  colorClass: string;
  fillClass?: string;
  height?: number;
  width?: number;
}

export const MiniAreaChart: React.FC<MiniAreaChartProps> = ({
  data,
  colorClass,
}) => {
  // Pad data to ensure it always spans the full width even if history is short
  const paddedData = useMemo(() => {
    const targetLength = 30; // Matches MAX_HISTORY
    if (data.length === 0) return Array(targetLength).fill(0);
    if (data.length >= targetLength) return data.slice(data.length - targetLength);
    // Pad left with first value
    return [...Array(targetLength - data.length).fill(data[0]), ...data];
  }, [data]);

  const { pathData, fillPathData } = useMemo(() => {
    if (paddedData.length === 0) return { pathData: '', fillPathData: '' };

    // Calculate dynamic max value, with a minimum of 10 to avoid division by zero and tiny noise spikes
    const rawMax = Math.max(...paddedData);
    const max = Math.max(10, rawMax * 1.2); // Add 20% headroom

    const points = paddedData.map((val, i) => {
      const x = (i / (paddedData.length - 1)) * 100;
      // Y is inverted (0 is top, 40 is bottom in viewBox)
      const y = 40 - (Math.min(max, Math.max(0, val)) / max) * 40;
      return { x, y };
    });

    // Create curved path
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 === points.length ? i + 1 : i + 2];

      // Catmull-Rom to Cubic Bezier conversion (simple)
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const fillD = `${d} L 100 40 L 0 40 Z`;

    return { pathData: d, fillPathData: fillD };
  }, [paddedData]);

  return (
    <div className="w-full h-full">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        {/* Fill Area with Gradient */}
        <defs>
          <linearGradient id={`gradient-${colorClass}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.4} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        
        <motion.path
          d={fillPathData}
          fill={`url(#gradient-${colorClass})`}
          className={colorClass}
          transition={{ duration: 0.5 }}
        />
        
        {/* Stroke Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${colorClass} drop-shadow-[0_0_3px_currentColor]`}
          transition={{ duration: 0.5 }}
        />
      </svg>
    </div>
  );
};
