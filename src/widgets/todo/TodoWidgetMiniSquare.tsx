import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, GripHorizontal } from 'lucide-react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { CircularProgress } from '../system/components/CircularProgress';
import { TodoAddModal } from './TodoAddModal';

export interface TodoWidgetMiniSquareProps {
  preview?: boolean;
  onClick?: () => void;
}

export const TodoWidgetMiniSquare: React.FC<TodoWidgetMiniSquareProps> = ({ preview = false, onClick }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { todos, toggleTodo } = useTodoStore();
  const { theme } = useThemeStore();
  
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  // Show all tasks to enable scrolling
  const displayTodos = todos;

  const handleAdd = () => {
    setIsAdding(true);
  };

  const innerContent = (
    <GlassCard
      blur="xl"
      frost="medium"
      className="w-full h-full flex flex-col p-6 rounded-3xl"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6 drag-handle cursor-move">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${theme.colors.primary}80)` }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <h2 className="text-lg font-bold tracking-wider text-white">TASKS</h2>
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          <GripHorizontal size={20} />
        </button>
      </div>

      {/* Big Circular Progress Row */}
      <div className="flex items-center gap-6 mb-8 mt-2 justify-center">
        <CircularProgress 
          progress={progress} 
          size={100} 
          strokeWidth={8} 
          colorHex={theme.colors.primary}
        >
          <div className="flex flex-col items-center justify-center -mt-0.5">
             <span className="text-2xl font-bold tracking-tight text-white">
               {Math.round(progress)}<span className="text-sm">%</span>
             </span>
          </div>
        </CircularProgress>

        <div className="flex flex-col">
          <span className="text-3xl font-bold tracking-wider text-white mb-1">
            {completedCount} <span className="text-gray-400 text-xl">/ {totalCount}</span>
          </span>
          <span className="text-sm text-gray-400 font-medium">completed</span>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar flex flex-col cursor-auto gap-4">
        <AnimatePresence initial={false}>
          {displayTodos.map((todo) => (
            <motion.div
              key={todo.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group flex items-start gap-4 border-white/5 relative"
            >
              <button 
                onClick={() => toggleTodo(todo.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 mt-0.5"
                style={{
                  backgroundColor: todo.completed ? theme.colors.primary : 'transparent',
                  border: `2px solid ${todo.completed ? theme.colors.primary : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: todo.completed ? `0 0 10px ${theme.colors.primary}60` : 'none'
                }}
              >
                <Check size={14} strokeWidth={3} className="text-white" style={{ opacity: todo.completed ? 1 : 0 }} />
              </button>
              
              <div className="flex-1 flex flex-col gap-0.5">
                <span 
                  className="text-sm font-medium text-white transition-all duration-300 flex-1 truncate"
                  style={{ opacity: todo.completed ? 0.9 : 1 }}
                >
                  {todo.text}
                </span>
                {todo.time && (
                  <span className="text-xs" style={{ color: todo.completed ? 'rgba(255,255,255,0.4)' : theme.colors.primary }}>
                    {todo.time}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer (Centered Circular Add) */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center cursor-auto">
        <button 
          onClick={handleAdd}
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center hover:opacity-80 transition-opacity"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <Plus size={20} strokeWidth={2} style={{ color: theme.colors.primary }} />
        </button>
      </div>

      {isAdding && <TodoAddModal onClose={() => setIsAdding(false)} />}
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 140, height: 180 }}
      >
        <div style={{ transform: 'scale(0.5)', width: 280, height: 360 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="todo-widget-mini-square"
      defaultPosition={{ x: 300, y: 100 }} 
      defaultSize={{ width: 280, height: 420 }}
      minWidth={260}
      maxWidth={380}
      minHeight={360}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};
