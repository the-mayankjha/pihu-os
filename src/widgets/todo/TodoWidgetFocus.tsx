import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Star, Trash2 } from 'lucide-react';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import { WidgetContainer } from '../../shared/components/WidgetContainer/WidgetContainer';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { TodoAddModal } from './TodoAddModal';

export interface TodoWidgetFocusProps {
  preview?: boolean;
  onClick?: () => void;
}

export const TodoWidgetFocus: React.FC<TodoWidgetFocusProps> = ({ preview = false, onClick }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { todos, toggleTodo, deleteTodo, tagColors } = useTodoStore();
  const { theme } = useThemeStore();
  
  // "Today Focus" strictly filters for today's tasks
  const todayTodos = todos.filter(t => t.time && (t.time.includes('AM') || t.time.includes('PM') || t.time.includes('Today')));
  // If no tasks match the filter, show all tasks as fallback, but don't slice so we can scroll
  const displayTodos = todayTodos.length > 0 ? todayTodos : todos;

  const handleAdd = () => {
    setIsAdding(true);
  };

  const innerContent = (
    <GlassCard
      blur="xl"
      frost="medium"
      className="w-full h-full flex flex-col p-6 rounded-3xl relative"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6 drag-handle cursor-move">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-wide text-white">Today</h2>
          <span 
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
            style={{ backgroundColor: theme.colors.primary, boxShadow: `0 0 10px ${theme.colors.primary}60` }}
          >
            {displayTodos.length}
          </span>
        </div>
        <button className="text-sm hover:underline transition-all cursor-pointer" style={{ color: theme.colors.primary }}>
          View all
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 pb-16 custom-scrollbar flex flex-col cursor-auto">
        <AnimatePresence initial={false}>
          {displayTodos.map((todo) => (
            <motion.div
              key={todo.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group flex items-center gap-4 py-4 border-b border-white/5 relative"
            >
              <button 
                onClick={() => toggleTodo(todo.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: todo.completed ? theme.colors.primary : 'transparent',
                  border: `2px solid ${todo.completed ? theme.colors.primary : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: todo.completed ? `0 0 10px ${theme.colors.primary}60` : 'none'
                }}
              >
                <Check size={14} strokeWidth={3} className="text-white" style={{ opacity: todo.completed ? 1 : 0 }} />
              </button>
              
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span 
                  className="text-base font-medium text-white transition-all duration-300 truncate w-full block"
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

                <div className="flex items-center gap-4">
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

      {/* Floating Add Button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <button 
          onClick={handleAdd}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
          style={{ backgroundColor: theme.colors.primary, boxShadow: `0 4px 20px ${theme.colors.primary}60` }}
        >
          <Plus size={24} strokeWidth={3} className="text-white" />
        </button>
      </div>

      {isAdding && <TodoAddModal onClose={() => setIsAdding(false)} />}
    </GlassCard>
  );

  if (preview) {
    return (
      <div 
        onClick={onClick}
        className="rounded-[24px] flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform overflow-hidden shadow-lg pb-6"
        style={{ width: 175, height: 165 }}
      >
        <div style={{ transform: 'scale(0.5)', width: 350, height: 330 }} className="flex-shrink-0 origin-center flex items-center justify-center pointer-events-none">
           {innerContent}
        </div>
      </div>
    );
  }

  return (
    <WidgetContainer 
      id="todo-widget-focus"
      defaultPosition={{ x: 100, y: 500 }} 
      defaultSize={{ width: 350, height: 260 }}
      minWidth={300}
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
