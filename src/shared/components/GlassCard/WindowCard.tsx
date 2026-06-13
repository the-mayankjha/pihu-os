import React from 'react';
import { GlassCard, GlassCardProps } from './GlassCard';

export interface WindowCardProps extends GlassCardProps {
  borderless?: boolean;
  controls?: boolean;
  title?: string;
  icon?: string;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

export const WindowCard: React.FC<WindowCardProps> = ({
  borderless = false,
  controls = true,
  title,
  icon,
  onMinimize,
  onMaximize,
  onClose,
  children,
  className = '',
  ...props
}) => {
  return (
    <GlassCard 
      className={`w-full h-full flex flex-col ${className}`} 
      style={borderless ? { border: 'none', ...props.style } : props.style}
      {...props}
    >
      {/* Titlebar (Drag Handle) or Absolute Window Controls */}
      {borderless ? (
        controls && (
          <div className="absolute top-4 right-4 z-[100] flex items-center gap-2">
            {onMinimize && (
              <button 
                onClick={onMinimize}
                className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FFD173] transition-colors flex items-center justify-center cursor-default"
              />
            )}
            {onMaximize && (
              <button 
                onClick={onMaximize}
                className="w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#4DDE63] transition-colors flex items-center justify-center cursor-default"
              />
            )}
            {onClose && (
              <button 
                onClick={onClose}
                className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF8A83] transition-colors flex items-center justify-center cursor-default"
              />
            )}
          </div>
        )
      ) : (
        <div className="plugin-drag-handle flex items-center justify-between px-4 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing shrink-0 bg-white/5 z-50">
          <div className="flex items-center gap-2">
            {icon && <img src={icon} alt={title || 'Window Icon'} className="w-5 h-5 pointer-events-none" />}
            {title && <span className="text-white/80 font-medium text-sm select-none pointer-events-none">{title}</span>}
          </div>
          
          {/* Window Controls */}
          {controls && (
            <div className="flex items-center gap-2 z-50">
              {onMinimize && (
                <button 
                  onClick={onMinimize}
                  className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FFD173] transition-colors flex items-center justify-center cursor-default"
                />
              )}
              {onMaximize && (
                <button 
                  onClick={onMaximize}
                  className="w-3.5 h-3.5 rounded-full bg-[#27C93F] hover:bg-[#4DDE63] transition-colors flex items-center justify-center cursor-default"
                />
              )}
              {onClose && (
                <button 
                  onClick={onClose}
                  className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF8A83] transition-colors flex items-center justify-center cursor-default"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </GlassCard>
  );
};
