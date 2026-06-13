import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { motion, AnimatePresence } from 'framer-motion';
import { WindowCard } from '../../../shared/components/GlassCard/WindowCard';

interface PluginWindowProps {
  id: string;
  title: string;
  icon?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number | string; height: number | string };
  minWidth?: number;
  minHeight?: number;
  borderless?: boolean;
  controls?: boolean;
  children: React.ReactNode;
}

export const PluginWindow: React.FC<PluginWindowProps> = ({
  id,
  title,
  icon,
  isOpen,
  onClose,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 800, height: 600 },
  minWidth = 400,
  minHeight = 300,
  borderless = false,
  controls = true,
  children
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  if (!isOpen && !isMinimized) return null;

  return (
    <AnimatePresence>
      {!isMinimized && isOpen && (
        <Rnd
          key={id}
          default={{
            x: defaultPosition.x,
            y: defaultPosition.y,
            width: defaultSize.width,
            height: defaultSize.height,
          }}
          minWidth={minWidth}
          minHeight={minHeight}
          bounds="parent"
          dragHandleClassName="plugin-drag-handle"
          style={{ zIndex: 50 }}
          className="absolute"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex flex-col overflow-hidden rounded-[24px] shadow-2xl"
          >
            <WindowCard 
              blur="xl" 
              frost="heavy" 
              borderless={borderless}
              controls={controls}
              title={title}
              icon={icon}
              onMinimize={() => setIsMinimized(true)}
              onMaximize={() => setIsMaximized(!isMaximized)}
              onClose={onClose}
              className="w-full h-full flex flex-col"
            >
              {children}
            </WindowCard>
          </motion.div>
        </Rnd>
      )}
    </AnimatePresence>
  );
};
