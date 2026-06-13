import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../../../shared/components/GlassCard/GlassCard';

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
            <GlassCard blur="xl" frost="heavy" borderless={borderless} className="w-full h-full flex flex-col">
              {/* Titlebar (Drag Handle) or Absolute Window Controls */}
              {borderless ? (
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                  <button 
                    onClick={() => setIsMinimized(true)}
                    className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FFD173] transition-colors flex items-center justify-center cursor-default"
                  />
                  <button 
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#4DDE63] transition-colors flex items-center justify-center cursor-default"
                  />
                  <button 
                    onClick={onClose}
                    className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF8A83] transition-colors flex items-center justify-center cursor-default"
                  />
                </div>
              ) : (
                <div className="plugin-drag-handle flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing shrink-0 bg-white/5">
                  <div className="flex items-center gap-2">
                    {icon && <img src={icon} alt={title} className="w-5 h-5 pointer-events-none" />}
                    <span className="text-white/80 font-medium text-sm select-none pointer-events-none">{title}</span>
                  </div>
                  
                  {/* Window Controls */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsMinimized(true)}
                      className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FFD173] transition-colors flex items-center justify-center cursor-default"
                    />
                    <button 
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#4DDE63] transition-colors flex items-center justify-center cursor-default"
                    />
                    <button 
                      onClick={onClose}
                      className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF8A83] transition-colors flex items-center justify-center cursor-default"
                    />
                  </div>
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 overflow-hidden relative">
                {children}
              </div>
            </GlassCard>
          </motion.div>
        </Rnd>
      )}
    </AnimatePresence>
  );
};
