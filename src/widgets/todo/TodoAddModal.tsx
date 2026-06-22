import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronDown, Plus, Check, Flag, Calendar, AlertCircle, Folder, Tag } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { useTodoStore } from './useTodoStore';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';

interface TodoAddModalProps {
  onClose: () => void;
}

export const TodoAddModal: React.FC<TodoAddModalProps> = ({ onClose }) => {
  const { theme } = useThemeStore();
  const { addTodo, projects: storeProjects, tags: storeTags, tagColors, addProject, addTag } = useTodoStore();
  
  const [text, setText] = useState('');
  const [due, setDue] = useState('Today, 10:00 AM');
  const [priority, setPriority] = useState('High');
  const [project, setProject] = useState(storeProjects[0] || 'PIHU OS');
  const [tags, setTags] = useState<string[]>([]);

  const [activeDropdown, setActiveDropdown] = useState<'due' | 'priority' | 'project' | 'tags' | null>(null);
  const [newInput, setNewInput] = useState('');

  const modalRef = useRef<HTMLFormElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    addTodo({
      text: text.trim(),
      time: due.trim() || undefined,
      category: tags[0] || undefined,
      categoryColor: theme.colors.primary,
      project: project,
      priority: priority,
      tags: tags
    } as any); 
    
    onClose();
  };

  const dueOptions = ['Today, 10:00 AM', 'Tomorrow', 'Next Week', 'Next Month', 'No Date'];
  const priorityOptions = ['High', 'Medium', 'Low'];

  const toggleTag = (t: string) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleAddNewProject = () => {
    if (newInput.trim()) {
      addProject(newInput.trim());
      setProject(newInput.trim());
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

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-[380px] relative rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col"
          style={{ backgroundColor: '#131520', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles style={{ color: theme.colors.primary }} size={20} fill="currentColor" />
              <h3 className="text-lg font-bold text-white tracking-wide">Add Task</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6" ref={modalRef}>
            {/* Task Name Input */}
            <div>
              <input 
                type="text" 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="w-full bg-[#1A1D2B] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/10 transition-colors"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}
              />
            </div>

            {/* Config Rows */}
            <div className="flex flex-col gap-4">
              {/* Due */}
              <div className="flex items-center justify-between relative" data-dropdown>
                <div className="flex items-center gap-2 w-24 text-gray-300">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-sm font-medium">Due</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActiveDropdown(activeDropdown === 'due' ? null : 'due')}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-transparent hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  {due}
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'due' && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-[#1A1D2B] border border-white/10 rounded-xl overflow-hidden shadow-xl z-10 p-2 flex flex-col gap-1">
                    {dueOptions.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        onClick={() => { setDue(opt); setActiveDropdown(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors rounded-lg"
                      >
                        {opt}
                      </button>
                    ))}
                    <div className="border-t border-white/10 mt-1 pt-1 flex flex-col">
                      <button 
                        type="button"
                        onClick={() => setNewInput(newInput === 'showCustomDate' ? '' : 'showCustomDate')}
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors rounded-lg w-full text-left"
                      >
                        Custom Date & Time
                        <ChevronDown size={14} className={`transition-transform ${newInput === 'showCustomDate' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      <AnimatePresence>
                        {newInput === 'showCustomDate' && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2 pb-1 px-1">
                              <CustomDatePicker 
                                onSelect={(formatted) => setDue(formatted)}
                                themeColor={theme.colors.primary}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between relative" data-dropdown>
                <div className="flex items-center gap-2 w-24 text-gray-300">
                  <AlertCircle size={14} className="text-gray-400" />
                  <span className="text-sm font-medium">Priority</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-transparent hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Flag size={14} color={getPriorityColor(priority)} fill={getPriorityColor(priority)} />
                  {priority}
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'priority' && (
                  <div className="absolute top-full right-0 mt-1 w-32 bg-[#1A1D2B] border border-white/10 rounded-xl overflow-hidden shadow-xl z-10">
                    {priorityOptions.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        onClick={() => { setPriority(opt); setActiveDropdown(null); }}
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
                <div className="flex items-center gap-2 w-24 text-gray-300">
                  <Folder size={14} className="text-gray-400" />
                  <span className="text-sm font-medium">Project</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActiveDropdown(activeDropdown === 'project' ? null : 'project')}
                  className="flex items-center gap-2 text-sm font-semibold text-white bg-transparent hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="truncate max-w-[150px]">{project}</span>
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
                {activeDropdown === 'project' && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-[#1A1D2B] border border-white/10 rounded-xl overflow-hidden shadow-xl z-10 p-2 flex flex-col gap-1">
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      {storeProjects.map(opt => (
                        <button 
                          key={opt}
                          type="button"
                          onClick={() => { setProject(opt); setActiveDropdown(null); }}
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
                        className="flex-1 bg-black/20 rounded-md px-2 text-xs text-white focus:outline-none"
                        onKeyDown={e => e.key === 'Enter' && handleAddNewProject()}
                      />
                      <button type="button" onClick={handleAddNewProject} className="p-1 bg-white/10 rounded-md hover:bg-white/20">
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex items-center justify-between relative" data-dropdown>
                <div className="flex items-center gap-2 w-24 text-gray-300">
                  <Tag size={14} className="text-gray-400" />
                  <span className="text-sm font-medium">Tags</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {tags.map(tag => {
                    const tColor = tagColors[tag] || theme.colors.primary;
                    return (
                      <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold text-white/90 border flex items-center gap-1 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderColor: tColor + '4D', backgroundColor: tColor + '1A' }} onClick={() => toggleTag(tag)}>
                        {tag} <X size={10} />
                      </span>
                    );
                  })}
                  <button 
                    type="button" 
                    onClick={() => setActiveDropdown(activeDropdown === 'tags' ? null : 'tags')}
                    className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {activeDropdown === 'tags' && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-[#1A1D2B] border border-white/10 rounded-xl overflow-hidden shadow-xl z-10 p-2 flex flex-col gap-1">
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      {storeTags.map(opt => (
                        <button 
                          key={opt}
                          type="button"
                          onClick={() => toggleTag(opt)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          {opt}
                          {tags.includes(opt) && <Check size={14} style={{ color: tagColors[opt] || theme.colors.primary }} />}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-white/10 mt-1 pt-2 flex gap-2">
                      <input 
                        type="text"
                        value={newInput}
                        onChange={e => setNewInput(e.target.value)}
                        placeholder="New tag..."
                        className="flex-1 bg-black/20 rounded-md px-2 text-xs text-white focus:outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewTag();
                          }
                        }}
                      />
                      <button type="button" onClick={handleAddNewTag} className="p-1 bg-white/10 rounded-md hover:bg-white/20">
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Create Button */}
            <div className="mt-2">
              <button 
                type="submit"
                disabled={!text.trim()}
                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-50 transition-all cursor-pointer relative overflow-hidden group"
                style={{ 
                  background: `linear-gradient(90deg, ${theme.colors.primary}CC 0%, ${theme.colors.primary} 50%, ${theme.colors.primary}CC 100%)`,
                  boxShadow: `0 4px 20px ${theme.colors.primary}66`
                }}
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                Create Task
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
