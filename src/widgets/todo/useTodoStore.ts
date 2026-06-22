import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Todo {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  createdAt: number;
  time?: string;          // Keep as legacy due time / string
  dueDate?: string;       // NEW: Explicit due date if time is too ambiguous
  category?: string;
  categoryColor?: string;
  isStarred?: boolean;
  project?: string;
  workspace?: string;     // NEW
  priority?: string;      // High, Medium, Low
  tags?: string[];
  reminder?: string;      // NEW
  repeat?: string;        // NEW
  attachments?: string[]; // NEW
  subtasks?: {            // NEW
    id: string;
    title: string;
    completed: boolean;
  }[];
  isArchived?: boolean;   // NEW: for Archive Task intent
}

interface TodoState {
  todos: Todo[];
  projects: string[];
  tags: string[];
  tagColors: Record<string, string>;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  addTodo: (payload: Partial<Todo>) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  archiveTodo: (id: string) => void;
  duplicateTodo: (id: string) => void;
  moveTodo: (id: string, workspace?: string, project?: string) => void;
  reorderTodos: (todos: Todo[]) => void;
  clearCompleted: () => void;
  addProject: (project: string) => void;
  addTag: (tag: string) => void;
  setTagColor: (tag: string, color: string) => void;
}

const initialTodos: Todo[] = [
  {
    id: crypto.randomUUID(),
    text: "Design new task widget UI",
    completed: true,
    createdAt: Date.now() - 100000,
    time: "10:00 AM",
    category: "PIHU OS",
    categoryColor: "#8B5CF6", // purple-500
    isStarred: true,
    project: "PIHU OS",
    priority: "High",
    tags: ["UI/UX", "Design"]
  },
  {
    id: crypto.randomUUID(),
    text: "Implement AI context system",
    completed: true,
    createdAt: Date.now() - 90000,
    time: "01:30 PM",
    category: "PIHU OS",
    categoryColor: "#8B5CF6", // purple-500
    isStarred: true,
    project: "PIHU OS",
    priority: "High",
    tags: ["AI", "Backend"]
  },
  {
    id: crypto.randomUUID(),
    text: "Review PR #142",
    completed: false,
    createdAt: Date.now() - 80000,
    time: "03:00 PM",
    category: "AI Research",
    categoryColor: "#0EA5E9", // sky-500
    isStarred: true,
    project: "AI Research",
    priority: "Medium",
    tags: ["Code Review"]
  },
  {
    id: crypto.randomUUID(),
    text: "Update documentation",
    completed: false,
    createdAt: Date.now() - 70000,
    time: "Tomorrow",
    category: "Learning",
    categoryColor: "#F59E0B", // amber-500
    isStarred: true,
    project: "Documentation",
    priority: "Low",
    tags: ["Docs"]
  },
  {
    id: crypto.randomUUID(),
    text: "Workout & meditation",
    completed: false,
    createdAt: Date.now() - 60000,
    time: "07:00 PM",
    category: "Personal",
    categoryColor: "#22C55E", // green-500
    isStarred: true,
    project: "Personal",
    priority: "Medium",
    tags: ["Health"]
  }
];

const presetColors = [
  '#EF4444', // red-500
  '#F97316', // orange-500
  '#F59E0B', // amber-500
  '#10B981', // emerald-500
  '#06B6D4', // cyan-500
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
  '#D946EF', // fuchsia-500
  '#F43F5E', // rose-500
];

export const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      todos: initialTodos,
      projects: ["PIHU OS", "AI Research", "Personal", "Work"],
      tags: ["UI/UX", "Design", "Code Review", "Backend", "AI", "Health", "Docs"],
      tagColors: {
        "UI/UX": "#D946EF",
        "Design": "#F43F5E",
        "Code Review": "#3B82F6",
        "Backend": "#10B981",
        "AI": "#8B5CF6",
        "Health": "#F59E0B",
        "Docs": "#06B6D4"
      },
      focusedTaskId: null,

      setFocusedTaskId: (id) => set({ focusedTaskId: id }),

      addTodo: (payload) => set((state) => ({
        todos: [
          ...state.todos,
          {
            id: crypto.randomUUID(),
            completed: false,
            createdAt: Date.now(),
            isArchived: false,
            ...payload
          } as Todo
        ]
      })),

      updateTodo: (id, updates) => set((state) => ({
        todos: state.todos.map(todo =>
          todo.id === id ? { ...todo, ...updates } : todo
        )
      })),

      toggleTodo: (id) => set((state) => ({
        todos: state.todos.map(todo => 
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      })),

      deleteTodo: (id) => set((state) => ({
        todos: state.todos.filter(todo => todo.id !== id)
      })),

      archiveTodo: (id) => set((state) => ({
        todos: state.todos.map(todo =>
          todo.id === id ? { ...todo, isArchived: true } : todo
        )
      })),

      duplicateTodo: (id) => set((state) => {
        const todoToDuplicate = state.todos.find(t => t.id === id);
        if (!todoToDuplicate) return state;
        const newTodo = {
          ...todoToDuplicate,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          text: `${todoToDuplicate.text} (Copy)`
        };
        return { todos: [...state.todos, newTodo] };
      }),

      moveTodo: (id, workspace, project) => set((state) => ({
        todos: state.todos.map(todo => {
          if (todo.id === id) {
            const updates: Partial<Todo> = {};
            if (workspace !== undefined) updates.workspace = workspace;
            if (project !== undefined) updates.project = project;
            return { ...todo, ...updates };
          }
          return todo;
        })
      })),

      reorderTodos: (todos) => set({ todos }),

      clearCompleted: () => set((state) => ({
        todos: state.todos.filter(todo => !todo.completed)
      })),

      addProject: (project) => set((state) => ({
        projects: state.projects.includes(project) ? state.projects : [...state.projects, project]
      })),

      addTag: (tag) => set((state) => {
        if (state.tags.includes(tag)) return state;
        
        // Pick a random color for the new tag
        const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];
        return {
          tags: [...state.tags, tag],
          tagColors: { ...state.tagColors, [tag]: randomColor }
        };
      }),
      
      setTagColor: (tag, color) => set((state) => ({
        tagColors: { ...state.tagColors, [tag]: color }
      }))
    }),
    {
      name: 'pihu-todo-storage',
    }
  )
);
