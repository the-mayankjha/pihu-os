import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Star, Menu, Trash2 } from 'lucide-react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { CircularProgress } from '../system/components/CircularProgress';
import { TodoAddModal } from './TodoAddModal';

export interface TodoWidgetCompactProps {
  preview?: boolean;
  onClick?: () => void;
}

export const TodoWidgetCompact: React.FC<TodoWidgetCompactProps> = ({ preview = false, onClick }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { todos, toggleTodo, deleteTodo, tagColors } = useTodoStore();
  const { theme } = useThemeStore();
  
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  // Compact doesn't show tabs, just a clean list. We allow scrolling for all items.
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
        <div className="flex items-center gap-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${theme.colors.primary}80)` }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-wider text-white">TASKS</h2>
            <span className="text-sm text-gray-400">
              {completedCount} / {totalCount} completed
            </span>
          </div>
        </div>

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

      {/* Task List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar flex flex-col cursor-auto">
        <AnimatePresence initial={false}>
          {displayTodos.map((todo) => (
            <motion.div
              key={todo.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group flex items-center gap-3 py-2.5 border-b border-white/5 relative"
            >
              <button 
                onClick={() => toggleTodo(todo.id)}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: todo.completed ? theme.colors.primary : 'transparent',
                  border: `2px solid ${todo.completed ? theme.colors.primary : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: todo.completed ? `0 0 10px ${theme.colors.primary}60` : 'none'
                }}
              >
                <Check size={12} strokeWidth={3} className="text-white" style={{ opacity: todo.completed ? 1 : 0 }} />
              </button>
              
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span 
                  className="text-sm font-medium text-white transition-all duration-300 w-full block truncate"
                  style={{ opacity: todo.completed ? 0.9 : 1 }}
                >
                  {todo.text}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Hover Delete Action */}
                <button 
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-all cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>

                <div className="flex flex-col items-end gap-1">
                  {todo.time && (
                    <span className="text-xs whitespace-nowrap" style={{ color: todo.completed ? 'rgba(255,255,255,0.4)' : theme.colors.primary }}>
                      {todo.time}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between cursor-auto">
        <button 
          onClick={handleAdd}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          style={{ color: theme.colors.primary }}
        >
          <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: theme.colors.primary }}>
            <Plus size={14} strokeWidth={3} />
          </div>
          <span className="font-bold tracking-wide">Add Task</span>
        </button>
        <button className="text-gray-400 hover:text-white transition-colors">
          <Menu size={20} />
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
        style={{ width: 190, height: 190 }}
      >
        <div style={{ transform: 'scale(0.5)', width: 380, height: 380 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="todo-widget-compact"
      defaultPosition={{ x: 500, y: 100 }} 
      defaultSize={{ width: 380, height: 260 }}
      minWidth={320}
      maxWidth={380}
      minHeight={200}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};
