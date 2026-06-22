import React, { useState } from 'react';
import { PluginWindow } from '../../core/windows/components/PluginWindow';
import { useTodoStore } from './useTodoStore';
import {
  CheckCircle2, Plus, Inbox, Calendar, CalendarDays, Search, Check, 
  MoreHorizontal, Clock, Flag, Star, Bell, Paperclip, Tag, CircleDashed, X, LayoutGrid, CalendarPlus, AlignLeft, CheckSquare
} from 'lucide-react';

export const TaskWindow: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { todos, projects, focusedTaskId, setFocusedTaskId, toggleTodo, addTodo, updateTodo } = useTodoStore();
  const [activeFilter, setActiveFilter] = useState('Today');
  const [searchQuery, setSearchQuery] = useState('');
  
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
    >
      <div className="flex h-full w-full bg-[#0d0d0d] text-white font-sans overflow-hidden">
        
        {/* Sidebar Panel */}
        <div className="w-64 border-r border-[#222] bg-[#111] flex flex-col flex-shrink-0">
          <div className="p-4 flex items-center gap-3 font-semibold text-lg border-b border-[#222]">
            <CheckCircle2 className="text-purple-500" size={24} />
            <span>Tasks</span>
          </div>

          <div className="p-4">
            <button 
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 transition-colors text-white py-2 px-4 rounded-lg font-medium"
              onClick={() => {
                addTodo({ text: 'New Task', time: 'Today', project: 'Inbox' });
              }}
            >
              <Plus size={18} />
              New Task
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-3 space-y-1">
              <SidebarItem icon={<Inbox size={18} />} label="Inbox" count={todos.length} active={activeFilter === 'Inbox'} onClick={() => setActiveFilter('Inbox')} />
              <SidebarItem icon={<Calendar size={18} />} label="Today" count={todos.filter(t => !t.completed).length} active={activeFilter === 'Today'} onClick={() => setActiveFilter('Today')} />
              <SidebarItem icon={<CalendarDays size={18} />} label="Upcoming" active={activeFilter === 'Upcoming'} onClick={() => setActiveFilter('Upcoming')} />
              <SidebarItem icon={<LayoutGrid size={18} />} label="Filters & Labels" active={activeFilter === 'Filters'} onClick={() => setActiveFilter('Filters')} />
            </div>

            <div className="mt-8 px-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">Projects</div>
              <div className="space-y-1">
                {projects.map(project => (
                  <SidebarItem 
                    key={project} 
                    icon={<div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>} 
                    label={project} 
                    active={activeFilter === project} 
                    onClick={() => setActiveFilter(project)} 
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#222]">
            <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-xl">
              <div className="relative flex items-center justify-center">
                <CircleDashed size={32} className="text-purple-500" />
                <span className="absolute text-[10px] font-bold">80%</span>
              </div>
              <div>
                <div className="text-sm font-semibold">Daily Progress</div>
                <div className="text-xs text-gray-400">4 of 5 tasks done</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Task List Panel */}
        <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
          <div className="p-6 pb-2 border-b border-[#222]">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">{activeFilter} <span className="text-gray-500 text-xl font-medium">{filteredTodos.length}</span></h1>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-[#222] rounded-md text-gray-400 transition-colors"><MoreHorizontal size={20} /></button>
              </div>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search tasks..." 
                className="w-full bg-[#111] border border-[#222] text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-purple-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="space-y-1">
              {filteredTodos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${focusedTaskId === todo.id ? 'bg-[#222]' : 'hover:bg-[#1a1a1a]'}`}
                  onClick={() => setFocusedTaskId(todo.id)}
                >
                  <button 
                    className={`flex-shrink-0 w-5 h-5 rounded border ${todo.completed ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-500 hover:border-purple-400'} flex items-center justify-center transition-colors`}
                    onClick={(e) => { e.stopPropagation(); toggleTodo(todo.id); }}
                  >
                    {todo.completed && <Check size={14} strokeWidth={3} />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${todo.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {todo.text}
                    </div>
                    {todo.project && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#222] text-gray-400 border border-[#333] flex items-center gap-1">
                           {todo.project}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-500 hover:text-white"><Clock size={16} /></button>
                    <button className={`hover:text-yellow-400 ${todo.isStarred ? 'text-yellow-400' : 'text-gray-500'}`}><Star size={16} fill={todo.isStarred ? 'currentColor' : 'none'} /></button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {todo.time && <span className="flex items-center gap-1"><Calendar size={12}/> {todo.time}</span>}
                    {todo.priority === 'High' && <Flag size={14} className="text-red-500" fill="currentColor" />}
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
          </div>
        </div>

        {/* Task Details Panel */}
        {focusedTodo && (
          <div className="w-80 border-l border-[#222] bg-[#111] flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-[#222] flex justify-between items-center">
              <h3 className="font-semibold text-gray-200">Task Details</h3>
              <button className="text-gray-400 hover:text-white p-1" onClick={() => setFocusedTaskId(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              
              <div>
                <div className="flex items-start gap-3 mb-4">
                  <button 
                    className={`mt-1 flex-shrink-0 w-6 h-6 rounded border ${focusedTodo.completed ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-500'} flex items-center justify-center`}
                    onClick={() => toggleTodo(focusedTodo.id)}
                  >
                    {focusedTodo.completed && <Check size={16} strokeWidth={3} />}
                  </button>
                  <textarea 
                    className="w-full bg-transparent text-lg font-semibold text-white resize-none focus:outline-none placeholder-gray-600 min-h-[60px]" 
                    value={focusedTodo.text}
                    onChange={(e) => updateTodo(focusedTodo.id, { text: e.target.value })}
                    placeholder="Task title"
                  />
                </div>

                <div className="flex gap-2 mb-6">
                  <ActionButton icon={<CalendarPlus size={16} />} label="Add Date" />
                  <ActionButton icon={<Bell size={16} />} label="Remind" />
                  <ActionButton icon={<Paperclip size={16} />} label="Attach" />
                  <ActionButton icon={<MoreHorizontal size={16} />} />
                </div>
              </div>

              <div className="space-y-4">
                <DetailRow icon={<AlignLeft size={16} />} label="Description">
                  <textarea 
                    className="w-full bg-[#1a1a1a] rounded-md p-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none min-h-[80px]"
                    placeholder="Add description..."
                    defaultValue={""}
                  />
                </DetailRow>

                <DetailRow icon={<CheckSquare size={16} />} label="Subtasks">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                       <Plus size={14} className="text-purple-500" /> Add subtask
                    </div>
                  </div>
                </DetailRow>

                <div className="pt-4 border-t border-[#222] space-y-3">
                  <PropertyRow label="Due Date" value={focusedTodo.time || 'None'} icon={<Calendar size={14} />} />
                  <PropertyRow label="Project" value={focusedTodo.project || 'Inbox'} icon={<Inbox size={14} />} />
                  <PropertyRow label="Priority" value={focusedTodo.priority || 'None'} icon={<Flag size={14} />} 
                    valueClass={focusedTodo.priority === 'High' ? 'text-red-400' : ''} />
                  
                  <div className="flex items-start justify-between text-sm py-1">
                    <span className="text-gray-500 flex items-center gap-2 w-24"><Tag size={14} /> Tags</span>
                    <div className="flex-1 flex flex-wrap gap-1 justify-end">
                      {focusedTodo.tags?.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a2a] text-gray-300">
                          {tag}
                        </span>
                      ))}
                      <button className="px-2 py-0.5 rounded text-[10px] border border-dashed border-gray-600 text-gray-500 hover:text-gray-300">
                        + Add Tag
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-4 border-t border-[#222] text-xs text-gray-500 text-center">
              Created {new Date(focusedTodo.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}

      </div>
    </PluginWindow>
  );
};

// --- Helper Components ---

function SidebarItem({ icon, label, count, active, onClick }: { icon: React.ReactNode, label: string, count?: number, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${active ? 'bg-[#222] text-white' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-xs font-semibold bg-[#2a2a2a] px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode, label?: string }) {
  return (
    <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#222] hover:bg-[#2a2a2a] text-gray-300 text-xs font-medium transition-colors">
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode, label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function PropertyRow({ label, value, icon, valueClass }: { label: string, value: string, icon: React.ReactNode, valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-gray-500 flex items-center gap-2 w-24">{icon} {label}</span>
      <span className={`text-gray-200 text-right ${valueClass || ''}`}>{value}</span>
    </div>
  );
}
