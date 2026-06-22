import React from 'react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { CircularProgress } from '../system/components/CircularProgress';

export interface TodoWidgetTinyBarProps {
  preview?: boolean;
  onClick?: () => void;
}

export const TodoWidgetTinyBar: React.FC<TodoWidgetTinyBarProps> = ({ preview = false, onClick }) => {
  const { todos } = useTodoStore();
  const { theme } = useThemeStore();
  
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  const innerContent = (
    <GlassCard
      blur="xl"
      frost="medium"
      className="w-full h-full flex items-center justify-between px-6 drag-handle cursor-move rounded-full"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
    >
      <div className="flex items-center gap-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${theme.colors.primary}80)` }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M16 13H8"></path>
          <path d="M16 17H8"></path>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h2 className="text-xl font-bold tracking-wider text-white">TASKS</h2>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-sm font-bold tracking-widest text-gray-400">
          <span className="text-white">{completedCount}</span> / {totalCount}
        </span>
        <CircularProgress 
          progress={progress} 
          size={56} 
          strokeWidth={6} 
          colorHex={theme.colors.primary}
        >
          <div className="flex flex-col items-center justify-center -mt-0.5">
             <span className="text-sm font-bold tracking-tight text-white">
               {Math.round(progress)}<span className="text-[10px]">%</span>
             </span>
          </div>
        </CircularProgress>
      </div>
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-full flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 175, height: 45 }}
      >
        <div style={{ transform: 'scale(0.5)', width: 350, height: 90 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="todo-widget-tiny-bar"
      defaultPosition={{ x: 500, y: 500 }} 
      defaultSize={{ width: 350, height: 90 }}
      minWidth={300}
      maxWidth={380}
      minHeight={90}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};
