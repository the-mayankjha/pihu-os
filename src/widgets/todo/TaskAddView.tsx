import React, { useState } from 'react';
import { 
  X, Calendar, Clock, Flag, Tag, Plus, AlertCircle,
  Bell, Paperclip, MoreHorizontal, CircleDashed
} from 'lucide-react';
import { useTodoStore } from './useTodoStore';

export const TaskAddView: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const { addTodo, projects: storeProjects, tags: storeTags } = useTodoStore();
  
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [priority, setPriority] = useState('Medium');
  const [project, setProject] = useState('PIHU OS');
  const [tags, setTags] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<{id: string, title: string, completed: boolean}[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const handleCreate = () => {
    if (!taskName.trim()) return;
    
    addTodo({
      text: taskName.trim(),
      description: description.trim() || undefined,
      time: allDay ? 'All day' : (time || dueDate || undefined),
      priority,
      project,
      tags,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    } as any);
    
    onCancel();
  };

  const applyTemplate = (name: string, desc: string, prio: string, proj: string, tgs: string[]) => {
    setTaskName(name);
    setDescription(desc);
    setPriority(prio);
    setProject(proj);
    setTags(tgs);
  };

  const toggleTag = (t: string) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const addSubtask = () => {
    if (subtaskInput.trim()) {
      setSubtasks([...subtasks, { id: crypto.randomUUID(), title: subtaskInput.trim(), completed: false }]);
      setSubtaskInput('');
    }
  };

  return (
    <div className="flex-1 flex bg-transparent min-w-0 h-full">
      {/* Left Column: Form */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/5">
        <div className="px-8 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">New Task</h1>
            <p className="text-sm text-gray-400">Create a new task and add details</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
          {/* Task Name */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Task Name *</label>
              <span className="text-xs text-gray-500">{taskName.length}/120</span>
            </div>
            <input 
              type="text" 
              maxLength={120}
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-[#131520]/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a6d]/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</label>
              <span className="text-xs text-gray-500">{description.length}/1000</span>
            </div>
            <textarea 
              maxLength={1000}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details about this task (optional)"
              className="w-full bg-[#131520]/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a6d]/50 transition-colors resize-none h-28"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Due Date</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  placeholder="Select date"
                  className="w-full bg-[#131520]/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a6d]/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Time</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text" 
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    placeholder="Select time"
                    disabled={allDay}
                    className={`w-full bg-[#131520]/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a6d]/50 transition-colors ${allDay ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={allDay}
                    onChange={e => setAllDay(e.target.checked)}
                    className="rounded bg-[#131520] border border-white/10 w-4 h-4 checked:bg-[#ff2a6d] checked:border-[#ff2a6d]"
                  />
                  All day
                </label>
              </div>
            </div>
          </div>

          {/* Priority & Project */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Priority</label>
              <div className="relative">
                <Flag size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${priority === 'High' ? 'text-red-500' : priority === 'Medium' ? 'text-yellow-500' : 'text-blue-500'}`} />
                <select 
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="w-full bg-[#131520]/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff2a6d]/50 transition-colors appearance-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Project</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#8b5cf6]"></div>
                <select 
                  value={project}
                  onChange={e => setProject(e.target.value)}
                  className="w-full bg-[#131520]/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff2a6d]/50 transition-colors appearance-none"
                >
                  {storeProjects.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Tags</label>
            <div className="w-full bg-[#131520]/80 border border-white/5 rounded-xl p-2 min-h-[46px] flex flex-wrap gap-2 items-center">
              {tags.map(t => (
                <span key={t} className="px-2 py-1 rounded-md text-xs bg-white/5 text-gray-300 flex items-center gap-1 group">
                  {t}
                  <button onClick={() => toggleTag(t)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"><X size={12} /></button>
                </span>
              ))}
              <div className="relative flex-1 min-w-[150px]">
                <select 
                  onChange={e => { if(e.target.value) { toggleTag(e.target.value); e.target.value = ""; } }}
                  className="w-full bg-transparent border-none text-sm text-gray-400 focus:outline-none appearance-none px-2"
                >
                  <option value="">Add tags (e.g. Design, UI/UX, Important)</option>
                  {storeTags.filter(t => !tags.includes(t)).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtasks</label>
              <span className="text-xs text-gray-500">{subtasks.length}/10</span>
            </div>
            <div className="space-y-2 mb-2">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-3 bg-[#131520]/40 border border-white/5 rounded-lg px-4 py-2">
                  <CircleDashed size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-200 flex-1">{st.title}</span>
                  <button onClick={() => setSubtasks(subtasks.filter(s => s.id !== st.id))} className="text-gray-500 hover:text-white"><X size={14} /></button>
                </div>
              ))}
            </div>
            {subtasks.length < 10 && (
              <div className="relative">
                <input 
                  type="text" 
                  value={subtaskInput}
                  onChange={e => setSubtaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubtask()}
                  placeholder="Add a subtask"
                  className="w-full bg-[#131520]/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a6d]/50 transition-colors"
                />
                <button 
                  onClick={addSubtask}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-white/5 flex items-center justify-between bg-[#131520]/40">
          <button 
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors flex items-center gap-2 ${taskName.trim() ? 'bg-[#ff2a6d] hover:bg-[#ff2a6d]/80 shadow-[0_0_20px_rgba(255,42,109,0.3)]' : 'bg-white/10 text-gray-400 cursor-not-allowed'}`}
          >
            Create Task
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-1 font-normal uppercase tracking-widest">Enter</span>
          </button>
        </div>
      </div>

      {/* Right Column: Tools & Preview */}
      <div className="w-[340px] flex flex-col bg-transparent shrink-0">
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
          
          {/* Quick Options */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Options</h3>
            <div className="grid grid-cols-3 gap-2">
              <button className="flex flex-col items-center justify-center gap-2 p-3 bg-[#131520]/80 border border-white/5 rounded-xl hover:bg-white/5 transition-colors group">
                <Calendar size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-medium text-gray-400 text-center leading-tight">Add to<br/>Calendar</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-3 bg-[#131520]/80 border border-white/5 rounded-xl hover:bg-white/5 transition-colors group">
                <Bell size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-medium text-gray-400 text-center leading-tight">Set<br/>Reminder</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-3 bg-[#131520]/80 border border-white/5 rounded-xl hover:bg-white/5 transition-colors group">
                <Paperclip size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-medium text-gray-400 text-center leading-tight">Attach<br/>Files</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-3 bg-[#131520]/80 border border-white/5 rounded-xl hover:bg-white/5 transition-colors group">
                <MoreHorizontal size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-medium text-gray-400 text-center leading-tight">More<br/>Options</span>
              </button>
            </div>
          </div>

          {/* Template Suggestions */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Template Suggestions</h3>
            <div className="space-y-2">
              {[
                { name: 'Meeting', desc: 'Schedule a meeting or call', icon: <Calendar size={16} className="text-purple-400" />, bg: 'bg-purple-500/10' },
                { name: 'Study', desc: 'Study or learning session', icon: <Tag size={16} className="text-green-400" />, bg: 'bg-green-500/10' },
                { name: 'Workout', desc: 'Exercise or fitness activity', icon: <Flag size={16} className="text-orange-400" />, bg: 'bg-orange-500/10' },
                { name: 'Personal', desc: 'Personal task or reminder', icon: <AlertCircle size={16} className="text-pink-400" />, bg: 'bg-pink-500/10' }
              ].map(tpl => (
                <div key={tpl.name} className="flex items-center justify-between p-3 bg-[#131520]/80 border border-white/5 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => applyTemplate(`${tpl.name}: `, tpl.desc, 'Medium', 'Personal', [tpl.name])}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tpl.bg}`}>{tpl.icon}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-200">{tpl.name}</div>
                      <div className="text-xs text-gray-500">{tpl.desc}</div>
                    </div>
                  </div>
                  <button className="text-gray-600 group-hover:text-white transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Preview</h3>
            <div className="p-4 bg-[#131520]/80 border border-white/5 rounded-xl">
              <div className="flex items-start gap-3">
                <CircleDashed size={18} className="text-gray-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white break-words">
                    {taskName || 'What needs to be done?'}
                  </div>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-gray-400">
                      <Flag size={12} className={priority === 'High' ? 'text-red-500' : priority === 'Medium' ? 'text-yellow-500' : 'text-blue-500'} /> 
                      {priority}
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]"></div>
                      {project}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <Calendar size={12} />
                    {allDay ? 'All day' : (time || dueDate || 'No due date')}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 text-gray-600">
                <Flag size={14} />
                <Bell size={14} />
                <Paperclip size={14} />
                <MoreHorizontal size={14} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
