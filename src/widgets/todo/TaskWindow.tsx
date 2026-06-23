import React, { useState } from 'react';
import { PluginWindow } from '../../core/windows/components/PluginWindow';
import { useTodoStore } from './useTodoStore';
import { TaskAddView } from './TaskAddView';
import { TaskEditableDetails } from './TaskEditableDetails';
import { CircularProgress } from '../system/components/CircularProgress';
import {
  CheckCircle2, Plus, Inbox, Calendar, CalendarDays, Search, Check, 
  MoreHorizontal, Clock, Flag, Star, Bell, Paperclip, CircleDashed, X, LayoutGrid, CalendarPlus
} from 'lucide-react';
import taskIcon from '../../assets/task.png';

export const TaskWindow: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { todos, projects, focusedTaskId, setFocusedTaskId, toggleTodo, updateTodo } = useTodoStore();
  const [activeFilter, setActiveFilter] = useState('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  const filteredTodos = todos.filter(todo => {
    if (searchQuery && !todo.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    if (activeFilter === 'Inbox') return true;
    if (activeFilter === 'Today') {
      return todo.time === 'Today' || !todo.completed; // Simple mock filter
    }
    if (activeFilter === 'Upcoming') {
      return todo.time === 'Tomorrow' || todo.dueDate;
    }
    if (projects.includes(activeFilter)) {
      return todo.project === activeFilter;
    }
    return true;
  });

  const focusedTodo = todos.find(t => t.id === focusedTaskId);

  return (
    <PluginWindow
      id="task-manager"
      title="Tasks"
      icon="CheckCircle2"
      isOpen={isOpen}
      onClose={onClose}
      defaultSize={{ width: 1100, height: 700 }}
      minWidth={800}
      minHeight={500}
      borderless
      frostui
    >
      <div className="flex flex-col h-full w-full bg-transparent text-white font-sans overflow-hidden">
        
        {/* Global Top Header */}
        <div className="plugin-drag-handle flex items-center gap-4 pl-4 md:pl-6 pr-24 py-3 shrink-0 z-20 relative border-b border-white/5 cursor-grab active:cursor-grabbing">
          {/* Hamburger & Logo */}
          <div className="flex items-center gap-4 w-[200px] shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div className="flex items-center gap-3">
              <img src={taskIcon} className="w-10 h-8 drop-shadow-lg" alt="Tasks" />
              <div>
                <div className="text-[10px] text-white/50 font-bold tracking-widest leading-none mb-0.5">PIHU OS</div>
                <div className="text-base font-bold tracking-wide leading-none">TASKS</div>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl bg-white/5 rounded-full flex items-center px-4 border border-white/5 transition-colors focus-within:border-white/20 focus-within:bg-white/10 relative ml-2">
            <Search className="text-gray-500" size={16} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-transparent border-none outline-none text-white px-4 py-2 text-sm placeholder-gray-500"
            />
          </div>

          {/* Right Area for Window Controls */}
          <div className="flex items-center gap-4 ml-auto pl-4 shrink-0 relative"></div>
        </div>

        {/* Body Container */}
        <div className="flex flex-1 overflow-hidden relative z-10">
          
          {/* Sidebar Panel */}
          <div className={`${isSidebarOpen ? 'w-[240px] opacity-100' : 'w-0 opacity-0 border-transparent'} transition-all duration-300 overflow-hidden border-r border-white/5 bg-transparent flex flex-col shrink-0 h-full`}>
            <div className="px-4 pt-6 pb-4">
            <button 
              className="w-full flex items-center justify-between bg-[#ff2a6d]/20 text-[#ff2a6d] border border-[#ff2a6d]/30 rounded-xl px-4 py-3 hover:bg-[#ff2a6d]/30 transition-colors"
              onClick={() => setIsAdding(true)}
            >
              <div className="flex items-center gap-2">
                <Plus size={18} />
                New Task
              </div>
              <span className="opacity-60 text-xs">⌄</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-3 space-y-1">
              <SidebarItem icon={<Inbox size={18} />} label="Inbox" count={todos.length} active={activeFilter === 'Inbox'} onClick={() => setActiveFilter('Inbox')} />
              <SidebarItem icon={<Calendar size={18} />} label="Today" count={todos.filter(t => !t.completed).length} active={activeFilter === 'Today'} onClick={() => setActiveFilter('Today')} />
              <SidebarItem icon={<CalendarDays size={18} />} label="Upcoming" count={5} active={activeFilter === 'Upcoming'} onClick={() => setActiveFilter('Upcoming')} />
              <SidebarItem icon={<Calendar size={18} />} label="Calendar" active={activeFilter === 'Calendar'} onClick={() => setActiveFilter('Calendar')} />
              <SidebarItem icon={<CheckCircle2 size={18} />} label="Completed" active={activeFilter === 'Completed'} onClick={() => setActiveFilter('Completed')} />
              <SidebarItem icon={<LayoutGrid size={18} />} label="All Tasks" count={32} active={activeFilter === 'All Tasks'} onClick={() => setActiveFilter('All Tasks')} />
            </div>

            <div className="mt-8 px-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">Projects</div>
              <div className="space-y-1">
                {projects.map((project, idx) => {
                  const colors = ['bg-[#ff2a6d]', 'bg-[#8b5cf6]', 'bg-[#0ea5e9]', 'bg-[#10b981]', 'bg-[#f59e0b]'];
                  return (
                    <SidebarItem 
                      key={project} 
                      icon={<div className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`}></div>} 
                      label={project} 
                      active={activeFilter === project} 
                      onClick={() => setActiveFilter(project)} 
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
              <CircularProgress 
                progress={progress} 
                size={46} 
                strokeWidth={4} 
                colorHex="#ff2a6d"
              >
                <div className="flex flex-col items-center justify-center">
                   <span className="text-xs font-bold tracking-tight text-white">
                     {Math.round(progress)}<span className="text-[9px] text-gray-300 ml-0.5">%</span>
                   </span>
                </div>
              </CircularProgress>
              <div>
                <div className="text-sm font-bold text-white mb-0.5">Daily Progress</div>
                <div className="text-xs text-gray-400 font-medium">{completedCount} of {totalCount} tasks completed</div>
              </div>
            </div>
          </div>
        </div>

        {isAdding ? (
          <TaskAddView onCancel={() => setIsAdding(false)} />
        ) : (
          <>
            {/* Main Task List Panel */}
            <div className="flex-1 flex flex-col bg-transparent min-w-0">
          <div className="px-8 pt-6 pb-4 border-b border-white/5">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                  {activeFilter} 
                  <span className="bg-[#ff2a6d]/20 text-[#ff2a6d] text-base font-semibold w-7 h-7 rounded-full flex items-center justify-center">{filteredTodos.length}</span>
                </h1>
                <div className="text-gray-400 text-sm mt-2">June 22, Monday</div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 transition-colors"><LayoutGrid size={18} /></button>
                <button className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 transition-colors"><MoreHorizontal size={18} /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="space-y-3">
              {filteredTodos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${focusedTaskId === todo.id ? 'bg-white/10 border-white/10 shadow-lg' : 'bg-transparent border-white/5 hover:bg-white/5'}`}
                  onClick={() => setFocusedTaskId(todo.id)}
                >
                  <button 
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 ${todo.completed ? 'bg-[#ff2a6d] border-[#ff2a6d] text-white' : 'border-gray-500 hover:border-[#ff2a6d]'} flex items-center justify-center transition-colors`}
                    onClick={(e) => { e.stopPropagation(); toggleTodo(todo.id); }}
                  >
                    {todo.completed && <Check size={14} strokeWidth={3} />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-base font-medium truncate ${todo.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {todo.text}
                    </div>
                    {todo.project && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[#3b82f6]/10 text-[#3b82f6]">
                           {todo.project}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-500 hover:text-white"><Clock size={18} /></button>
                    <button className={`hover:text-yellow-400 ${todo.isStarred ? 'text-yellow-400' : 'text-gray-500'}`}><Star size={18} fill={todo.isStarred ? 'currentColor' : 'none'} /></button>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400 min-w-[120px] justify-end">
                    {todo.time && <span>{todo.time}</span>}
                    {todo.priority === 'High' ? <Flag size={16} className="text-[#ff2a6d]" fill="none" strokeWidth={2.5}/> : <Flag size={16} className="text-gray-500" />}
                  </div>
                </div>
              ))}
              
              {filteredTodos.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                  <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No tasks found.</p>
                </div>
              )}
            </div>
            
            <button 
              className="mt-6 flex items-center gap-2 text-[#ff2a6d] font-medium px-4 py-2 hover:bg-[#ff2a6d]/10 rounded-lg transition-colors"
              onClick={() => setIsAdding(true)}
            >
              <Plus size={18} /> Add Task
            </button>
          </div>
        </div>

        {/* Task Details Panel */}
        {focusedTodo && (
          <div className="w-[340px] border-l border-white/5 bg-transparent flex flex-col shrink-0 relative">
            <div className="h-[68px] flex items-center justify-start px-4 border-b border-white/5">
              <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10" onClick={() => setFocusedTaskId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              
              <div>
                <div className="flex items-start gap-3 mb-4">
                  <button 
                    className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 ${focusedTodo.completed ? 'bg-[#ff2a6d] border-[#ff2a6d] text-white' : 'border-gray-500'} flex items-center justify-center`}
                    onClick={() => toggleTodo(focusedTodo.id)}
                  >
                    {focusedTodo.completed && <Check size={14} strokeWidth={3} />}
                  </button>
                  <textarea 
                    className="w-full bg-transparent text-lg font-bold text-white resize-none focus:outline-none placeholder-gray-600 min-h-[60px]" 
                    value={focusedTodo.text}
                    onChange={(e) => updateTodo(focusedTodo.id, { text: e.target.value })}
                    placeholder="Task title"
                  />
                </div>

                <div className="flex gap-2 mb-6 text-[#ff2a6d]">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[#8b5cf6]/10 text-[#8b5cf6]">
                     PIHU OS
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-6">
                  <ActionButton icon={<CalendarPlus size={16} />} label="Add to Calendar" />
                  <ActionButton icon={<Bell size={16} />} label="Set Reminder" />
                  <ActionButton icon={<Paperclip size={16} />} label="Attach Files" />
                  <ActionButton icon={<MoreHorizontal size={16} />} label="More" />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200 mb-2">Description</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Create a clean and modern task widget UI that matches the PIHU OS aesthetic. It should show progress, upcoming tasks and quick actions.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">Subtasks <span className="text-xs text-gray-500 font-normal">3/6</span></h4>
                    <span className="text-xs text-gray-400">50%</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full mb-4">
                    <div className="h-full bg-[#ff2a6d] rounded-full" style={{width: '50%'}}></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-[#ff2a6d]" fill="currentColor" stroke="black"/> Create wireframes
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-[#ff2a6d]" fill="currentColor" stroke="black"/> Design light & dark variants
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <CheckCircle2 size={16} className="text-[#ff2a6d]" fill="currentColor" stroke="black"/> Add progress visualization
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <CircleDashed size={16} /> Implement interactions
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <CircleDashed size={16} /> Test responsiveness
                    </div>
                  </div>
                </div>

                <TaskEditableDetails todo={focusedTodo} />

              </div>
            </div>

            <div className="p-5 border-t border-white/5 flex justify-between items-center text-xs text-gray-500">
              <span>Created by Mayank ✨</span>
              <span>June 20, 2026</span>
            </div>
          </div>
        )}
          </>
        )}

        </div>
      </div>
    </PluginWindow>
  );
};

// --- Helper Components ---

function SidebarItem({ icon, label, count, active, onClick }: { icon: React.ReactNode, label: string, count?: number, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${active ? 'bg-[#ff2a6d]/10 text-[#ff2a6d] font-semibold' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={`text-xs font-semibold ${active ? 'text-[#ff2a6d]' : 'text-gray-500'}`}>{count}</span>
      )}
    </div>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label?: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors">
      <div className="text-gray-400">{icon}</div>
      {label && <span className="text-center leading-tight">{label}</span>}
    </button>
  );
}


