import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { CircularProgress } from '../system/components/CircularProgress';
import { TodoAddModal } from './TodoAddModal';

export interface TodoWidgetHorizontalProps {
  preview?: boolean;
  onClick?: () => void;
}

export const TodoWidgetHorizontal: React.FC<TodoWidgetHorizontalProps> = ({ preview = false, onClick }) => {
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
      <div className="flex justify-between items-end mb-6 drag-handle cursor-move">
        <h2 className="text-xl font-bold tracking-wider text-white">TASKS</h2>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tracking-widest text-gray-400">
            <span className="text-white">{completedCount}</span> of {totalCount}
          </span>
          <CircularProgress 
            progress={progress} 
            size={48} 
            strokeWidth={5} 
            colorHex={theme.colors.primary}
          >
            <div className="flex flex-col items-center justify-center -mt-0.5">
               <span className="text-xs font-bold tracking-tight text-white">
                 {Math.round(progress)}<span className="text-[10px]">%</span>
               </span>
            </div>
          </CircularProgress>
        </div>
      </div>

      {/* Horizontal Cards Area */}
      <div className="flex items-center gap-4 w-full h-full relative cursor-auto">
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar flex items-center gap-4 pb-2 h-full">
          <AnimatePresence initial={false}>
            {todos.map((todo) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex-shrink-0 w-44 h-full min-h-[100px] rounded-2xl border p-4 flex flex-col justify-between transition-all"
                style={{
                  backgroundColor: todo.completed ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                  borderColor: todo.completed ? 'transparent' : 'rgba(255,255,255,0.1)'
                }}
              >
                <div className="flex items-start gap-2">
                  <button 
                    onClick={() => toggleTodo(todo.id)}
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 mt-0.5"
                    style={{
                      backgroundColor: todo.completed ? theme.colors.primary : 'transparent',
                      border: `2px solid ${todo.completed ? theme.colors.primary : 'rgba(255,255,255,0.2)'}`,
                      boxShadow: todo.completed ? `0 0 10px ${theme.colors.primary}60` : 'none'
                    }}
                  >
                    <Check size={12} strokeWidth={3} className="text-white" style={{ opacity: todo.completed ? 1 : 0 }} />
                  </button>
                  <span 
                    className="text-sm font-medium text-white transition-all duration-300 line-clamp-3"
                    style={{ opacity: todo.completed ? 0.7 : 1 }}
                  >
                    {todo.text}
                  </span>
                </div>
                {todo.time && (
                  <span className="text-xs font-bold mt-2" style={{ color: todo.completed ? 'rgba(255,255,255,0.3)' : theme.colors.primary }}>
                    {todo.time}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Fixed Add Button on the right */}
        <button 
          onClick={handleAdd}
          className="flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center hover:opacity-80 transition-opacity ml-2"
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
        style={{ width: 250, height: 125 }}
      >
        <div style={{ transform: 'scale(0.5)', width: 500, height: 250 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="todo-widget-horizontal"
      defaultPosition={{ x: 100, y: 100 }} 
      defaultSize={{ width: 500, height: 250 }}
      minWidth={400}
      minHeight={200}
      isDraggable={true}
      isResizable={true}
      isRemovable={true}
    >
      {innerContent}
    </WidgetContainer>
  );
};
