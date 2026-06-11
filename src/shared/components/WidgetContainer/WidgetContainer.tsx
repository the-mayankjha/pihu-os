import React, { useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useLayoutStore } from '../../../core/layout/LayoutStore';

export interface WidgetContainerProps {
  id: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number | string; height: number | string };
  minWidth?: number;
  minHeight?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  id,
  children,
  defaultPosition = { x: 0, y: 0 },
  defaultSize = { width: 'auto', height: 'auto' },
  minWidth = 200,
  minHeight = 100,
  isDraggable = true,
  isResizable = true,
}) => {
  const { widgets, registerWidget, updateWidgetPosition, updateWidgetSize } = useLayoutStore();
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    registerWidget(id, defaultPosition, defaultSize);
    setIsRegistered(true);
  }, [id, defaultPosition, defaultSize, registerWidget]);

  // Don't render until registered to ensure we use the persisted state
  if (!isRegistered || !widgets[id]) return null;

  const widgetState = widgets[id];

  return (
    <Rnd
      default={{
        x: widgetState.position.x,
        y: widgetState.position.y,
        width: widgetState.size.width,
        height: widgetState.size.height,
      }}
      minWidth={minWidth}
      minHeight={minHeight}
      disableDragging={!isDraggable}
      enableResizing={
        isResizable
          ? {
              top: true, right: true, bottom: true, left: true,
              topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
            }
          : false
      }
      bounds="parent"
      className="z-10"
      dragHandleClassName="drag-handle"
      onDragStop={(e, d) => {
        updateWidgetPosition(id, { x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        updateWidgetSize(id, { width: ref.style.width, height: ref.style.height });
        updateWidgetPosition(id, position);
      }}
    >
      <div className="w-full h-full flex flex-col rounded-[32px] bg-slate-800/40 backdrop-blur-[60px] border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] drag-handle relative">
        {children}
      </div>
    </Rnd>
  );
};
