import React from 'react';
import { Rnd } from 'react-rnd';

export interface WidgetContainerProps {
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number | string; height: number | string };
  minWidth?: number;
  minHeight?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  children,
  defaultPosition = { x: 0, y: 0 },
  defaultSize = { width: 'auto', height: 'auto' },
  minWidth = 200,
  minHeight = 100,
  isDraggable = true,
  isResizable = true,
}) => {
  return (
    <Rnd
      default={{
        x: defaultPosition.x,
        y: defaultPosition.y,
        width: defaultSize.width,
        height: defaultSize.height,
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
    >
      <div className="w-full h-full flex flex-col">
        {children}
      </div>
    </Rnd>
  );
};
