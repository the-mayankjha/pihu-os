import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { CircularProgress } from '../system/components/CircularProgress';
import { TodoAddModal } from './TodoAddModal';

export interface TodoWidgetMinimalBarProps {
  preview?: boolean;
  onClick?: () => void;
}

export const TodoWidgetMinimalBar: React.FC<TodoWidgetMinimalBarProps> = ({ preview = false, onClick }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { todos, toggleTodo } = useTodoStore();
  const { theme } = useThemeStore();
  
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

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
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5 drag-handle cursor-move">
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
            size={48} 
            strokeWidth={5} 
            colorHex={theme.colors.primary}
          >
            <div className="flex flex-col items-center justify-center -mt-0.5">
               <span className="text-sm font-bold tracking-tight text-white">
                 {Math.round(progress)}<span className="text-[10px]">%</span>
               </span>
            </div>
          </CircularProgress>
        </div>
      </div>

      {/* Horizontal Tasks Container */}
      <div className="flex-1 flex items-center gap-8 overflow-x-auto custom-scrollbar px-2 cursor-auto">
        <AnimatePresence initial={false}>
          {todos.slice(0, 4).map((todo) => (
            <motion.div
              key={todo.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center gap-3 w-32"
            >
              <button 
                onClick={() => toggleTodo(todo.id)}
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: todo.completed ? theme.colors.primary : 'transparent',
                  border: `2px solid ${todo.completed ? theme.colors.primary : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: todo.completed ? `0 0 20px ${theme.colors.primary}80` : 'none'
                }}
              >
                <Check size={24} strokeWidth={3} className="text-white" style={{ opacity: todo.completed ? 1 : 0 }} />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <span 
                  className="text-xs font-medium text-white transition-all duration-300 line-clamp-2"
                  style={{ opacity: todo.completed ? 0.7 : 1 }}
                >
                  {todo.text}
                </span>
                {todo.time && (
                  <span className="text-[10px] font-bold mt-1 tracking-wider" style={{ color: todo.completed ? 'rgba(255,255,255,0.4)' : theme.colors.primary }}>
                    {todo.time}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add Task Node */}
        <div className="flex flex-col items-center justify-center gap-3 w-32 shrink-0">
          <button 
            onClick={handleAdd}
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:opacity-80"
            style={{
              border: `2px dashed rgba(255,255,255,0.2)`,
            }}
          >
            <Plus size={24} className="text-gray-400" />
          </button>
          <span className="text-xs font-medium text-gray-400">Add Task</span>
        </div>
      </div>

      {isAdding && <TodoAddModal onClose={() => setIsAdding(false)} />}
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg"
        style={{ width: 350, height: 110 }}
      >
        <div style={{ transform: 'scale(0.5)', width: 700, height: 220 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="todo-widget-minimal-bar"
      defaultPosition={{ x: 100, y: 700 }} 
      defaultSize={{ width: 700, height: 220 }}
      minWidth={500}
      minHeight={200}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};
