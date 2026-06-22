import React, { useEffect, useState, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useLayoutStore } from '../../../core/layout/LayoutStore';
import { motion, AnimatePresence } from 'framer-motion';

export interface WidgetContainerProps {
  id: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number | string; height: number | string };
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  isDraggable?: boolean;
  isResizable?: boolean;
  isRemovable?: boolean;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  id,
  children,
  defaultPosition = { x: 0, y: 0 },
  defaultSize = { width: 'auto', height: 'auto' },
  minWidth = 200,
  minHeight = 100,
  maxWidth,
  maxHeight,
  isDraggable = true,
  isResizable = true,
  isRemovable = true,
}) => {
  const { widgets, registerWidget, updateWidgetPosition, updateWidgetSize, toggleWidget } = useLayoutStore();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editStartTimeRef = useRef<number>(0);

  useEffect(() => {
    registerWidget(id, defaultPosition, defaultSize);
    setIsRegistered(true);
  }, [id, defaultPosition, defaultSize, registerWidget]);

  // Don't render until registered to ensure we use the persisted state
  if (!isRegistered || !widgets[id]) return null;

  const widgetState = widgets[id];

  const handlePointerDown = () => {
    if (!isRemovable) return;
    if (isEditing) return; // Already editing
    
    // Clear any existing timer just in case
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      setIsEditing(true);
      editStartTimeRef.current = Date.now();
    }, 500); // slightly faster, 500ms
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerUp = () => {
    cancelPress();
  };

  return (
    <Rnd
      default={{
        x: widgetState.position.x,
        y: widgetState.position.y,
        width: !isResizable ? defaultSize.width : widgetState.size.width,
        height: !isResizable ? defaultSize.height : widgetState.size.height,
      }}
      size={!isResizable ? { width: defaultSize.width, height: defaultSize.height } : undefined}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      disableDragging={!isDraggable || isEditing}
      enableResizing={
        isResizable && !isEditing
          ? {
              top: true, right: true, bottom: true, left: true,
              topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
            }
          : false
      }
      bounds="parent"
      className="z-10"
      dragHandleClassName="drag-handle"
      onDrag={cancelPress} // Cancel only when actually moving
      onDragStop={(_e, d) => {
        cancelPress();
        updateWidgetPosition(id, { x: d.x, y: d.y });
      }}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        updateWidgetSize(id, { width: ref.style.width, height: ref.style.height });
        updateWidgetPosition(id, position);
      }}
    >
      <motion.div 
        animate={isEditing ? { rotate: [-1, 1.5, -1.5, 1, -1], transition: { repeat: Infinity, duration: 0.3 } } : { rotate: 0 }}
        onMouseDownCapture={handlePointerDown}
        onTouchStartCapture={handlePointerDown}
        onMouseUpCapture={handlePointerUp}
        onTouchEndCapture={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onClick={() => {
          if (isEditing) {
            // Prevent the initial "mouse up" from the long press from instantly triggering this click and closing the edit mode
            if (Date.now() - editStartTimeRef.current > 300) {
              setIsEditing(false);
            }
          }
        }}
        className={`w-full h-full flex flex-col rounded-[32px] bg-slate-800/40 backdrop-blur-[60px] border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] drag-handle relative ${isEditing ? 'cursor-default' : ''}`}
      >
        {/* Editing overlay to prevent interacting with the widget while trying to close it */}
        {isEditing && <div className="absolute inset-0 z-40 rounded-[32px] bg-black/10" />}
        
        <AnimatePresence>
          {isEditing && isRemovable && (
            <motion.button 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                toggleWidget(id);
                setIsEditing(false);
              }}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-700/80 backdrop-blur-md border border-white/20 text-white/90 flex items-center justify-center shadow-lg hover:bg-[#e3005b]/80 transition-colors z-50 cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {children}
      </motion.div>
    </Rnd>
  );
};
