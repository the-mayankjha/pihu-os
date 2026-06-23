import React, { useState, useEffect } from 'react';
import { ChevronDown, Folder, Calendar, Flag, Plus, X } from 'lucide-react';
import { useTodoStore } from './useTodoStore';
import type { Todo } from './useTodoStore';
import { useThemeStore } from '../../stores/themeStore';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';

export const TaskEditableDetails: React.FC<{ todo: Todo }> = ({ todo }) => {
  const { theme } = useThemeStore();
  const { updateTodo, projects: storeProjects, tags: storeTags, addProject, addTag } = useTodoStore();
  
  const [activeDropdown, setActiveDropdown] = useState<'due' | 'priority' | 'project' | 'tags' | null>(null);
  const [newInput, setNewInput] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-dropdown]')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'High': return '#EF4444';
      case 'Medium': return '#EAB308';
      case 'Low': return '#3B82F6';
      default: return '#9CA3AF';
    }
  };

  const dueOptions = ['Today, 10:00 AM', 'Tomorrow', 'Next Week', 'Next Month', 'No Date'];
  const priorityOptions = ['High', 'Medium', 'Low'];

  const toggleTag = (t: string) => {
    const currentTags = todo.tags || [];
    const newTags = currentTags.includes(t) ? currentTags.filter(x => x !== t) : [...currentTags, t];
    updateTodo(todo.id, { tags: newTags });
  };

  const handleAddNewProject = () => {
    if (newInput.trim()) {
      addProject(newInput.trim());
      updateTodo(todo.id, { project: newInput.trim() });
      setNewInput('');
      setActiveDropdown(null);
    }
  };

  const handleAddNewTag = () => {
    if (newInput.trim()) {
      addTag(newInput.trim());
      toggleTag(newInput.trim());
      setNewInput('');
    }
  };

  return (
    <div className="pt-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-200 mb-2">Details</h4>

      {/* Due Date */}
      <div className="flex items-center justify-between relative" data-dropdown>
        <div className="flex items-center gap-2 w-24 text-gray-500 text-sm">
          Due
        </div>
        <button 
          onClick={() => setActiveDropdown(activeDropdown === 'due' ? null : 'due')}
          className="flex items-center gap-2 text-sm font-medium text-gray-200 hover:bg-white/5 px-2 py-1 -mr-2 rounded-lg transition-colors"
        >
          <Calendar size={14} className={todo.time ? 'text-[#ff2a6d]' : 'text-gray-500'} />
          <span className={todo.time ? 'text-[#ff2a6d]' : 'text-gray-400'}>{todo.time || 'Add Date'}</span>
          <ChevronDown size={14} className="text-gray-600" />
        </button>
        {activeDropdown === 'due' && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-[#0a0a0f]/60 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden shadow-xl z-20">
            {dueOptions.map(opt => (
              <button 
                key={opt}
                onClick={() => { updateTodo(todo.id, { time: opt === 'No Date' ? undefined : opt }); setActiveDropdown(null); }}
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                {opt}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button 
                onClick={() => setNewInput(newInput === 'showCustomDate' ? '' : 'showCustomDate')}
                className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Custom Date
                <ChevronDown size={14} className={`transition-transform ${newInput === 'showCustomDate' ? 'rotate-180' : ''}`} />
              </button>
              {newInput === 'showCustomDate' && (
                <div className="p-2">
                  <CustomDatePicker 
                    onSelect={(formatted) => { updateTodo(todo.id, { time: formatted }); setActiveDropdown(null); }}
                    themeColor={theme.colors.primary}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="flex items-center justify-between relative" data-dropdown>
        <div className="flex items-center gap-2 w-24 text-gray-500 text-sm">
          Priority
        </div>
        <button 
          onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
          className="flex items-center gap-2 text-sm font-medium text-gray-200 hover:bg-white/5 px-2 py-1 -mr-2 rounded-lg transition-colors"
        >
          <Flag size={14} color={getPriorityColor(todo.priority || '')} fill={getPriorityColor(todo.priority || '')} />
          <span className={todo.priority ? 'text-[#ff2a6d]' : 'text-gray-400'} style={{ color: todo.priority ? getPriorityColor(todo.priority) : undefined }}>{todo.priority || 'Add Priority'}</span>
          <ChevronDown size={14} className="text-gray-600" />
        </button>
        {activeDropdown === 'priority' && (
          <div className="absolute top-full right-0 mt-1 w-32 bg-[#0a0a0f]/60 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden shadow-xl z-20">
            {priorityOptions.map(opt => (
              <button 
                key={opt}
                onClick={() => { updateTodo(todo.id, { priority: opt }); setActiveDropdown(null); }}
                className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
              >
                <Flag size={14} color={getPriorityColor(opt)} fill={getPriorityColor(opt)} />
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Project */}
      <div className="flex items-center justify-between relative" data-dropdown>
        <div className="flex items-center gap-2 w-24 text-gray-500 text-sm">
          Project
        </div>
        <button 
          onClick={() => setActiveDropdown(activeDropdown === 'project' ? null : 'project')}
          className="flex items-center gap-2 text-sm font-medium text-gray-200 hover:bg-white/5 px-2 py-1 -mr-2 rounded-lg transition-colors"
        >
          {todo.project ? <div className="w-2 h-2 rounded-full bg-[#8b5cf6]"></div> : <Folder size={14} className="text-gray-500"/>}
          <span className={todo.project ? 'text-[#8b5cf6]' : 'text-gray-400'}>{todo.project || 'Add Project'}</span>
          <ChevronDown size={14} className="text-gray-600" />
        </button>
        {activeDropdown === 'project' && (
          <div className="absolute top-full right-0 mt-1 w-56 bg-[#0a0a0f]/60 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden shadow-xl z-20 p-2 flex flex-col gap-1">
            <div className="max-h-40 overflow-y-auto custom-scrollbar">
              {storeProjects.map(opt => (
                <button 
                  key={opt}
                  onClick={() => { updateTodo(todo.id, { project: opt }); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 mt-1 pt-2 flex gap-2">
              <input 
                type="text"
                value={newInput}
                onChange={e => setNewInput(e.target.value)}
                placeholder="New project..."
                className="flex-1 bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff2a6d]/50"
                onKeyDown={e => e.key === 'Enter' && handleAddNewProject()}
              />
              <button 
                onClick={handleAddNewProject}
                className="p-1.5 bg-[#ff2a6d]/20 text-[#ff2a6d] rounded-lg hover:bg-[#ff2a6d]/30 transition-colors"
              >
                <Plus size={16} className="lucide-plus" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex items-start justify-between text-sm py-1 relative" data-dropdown>
        <span className="text-gray-500 mt-1">Tags</span>
        <div className="flex-1 flex flex-wrap gap-2 justify-end items-center">
          {(todo.tags || []).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-[#3b82f6]/10 text-[#3b82f6] flex items-center gap-1 group">
              {t}
              <button 
                onClick={() => toggleTag(t)}
                className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
              >
                <X size={10} className="lucide-x" />
              </button>
            </span>
          ))}
          <button 
            onClick={() => setActiveDropdown(activeDropdown === 'tags' ? null : 'tags')}
            className="w-5 h-5 rounded-full border border-gray-600 text-gray-500 flex items-center justify-center hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            +
          </button>
        </div>
        {activeDropdown === 'tags' && (
          <div className="absolute top-full right-0 mt-1 w-56 bg-[#0a0a0f]/60 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden shadow-xl z-20 p-2 flex flex-col gap-1">
            <div className="max-h-40 overflow-y-auto custom-scrollbar flex flex-wrap gap-2 p-1">
              {storeTags.map(opt => (
                <button 
                  key={opt}
                  onClick={() => toggleTag(opt)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${(todo.tags || []).includes(opt) ? 'bg-[#ff2a6d]/20 border-[#ff2a6d]/30 text-[#ff2a6d]' : 'bg-transparent border-white/10 text-gray-300 hover:border-white/30'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 mt-2 pt-2 flex gap-2">
              <input 
                type="text"
                value={newInput}
                onChange={e => setNewInput(e.target.value)}
                placeholder="New tag..."
                className="flex-1 bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff2a6d]/50"
                onKeyDown={e => e.key === 'Enter' && handleAddNewTag()}
              />
              <button 
                onClick={handleAddNewTag}
                className="p-1.5 bg-[#ff2a6d]/20 text-[#ff2a6d] rounded-lg hover:bg-[#ff2a6d]/30 transition-colors"
              >
                <Plus size={16} className="lucide-plus" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
