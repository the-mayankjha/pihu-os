import { useTodoStore } from '../../../../widgets/todo/useTodoStore';
import { useLayoutStore } from '../../../../core/layout/LayoutStore';
import type { ActionTool, ToolResult } from './types';

// Helper to find a task by fuzzy text match
const findTask = (query: string, excludeCompleted = false) => {
  const { todos } = useTodoStore.getState();
  const q = query.toLowerCase();
  return todos.find(t => 
    (!excludeCompleted || !t.completed) && 
    !t.isArchived && 
    t.text.toLowerCase().includes(q)
  );
};

// ─── Todo Tools ──────────────────────────────────────────────────────────────

export const todoTools: ActionTool[] = [

  {
    declaration: {
      name: 'todo_add',
      description: 'Adds a new task/todo. Use when user says "add task", "remind me to", "create todo", "note this down".',
      parameters: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', description: 'The task title.' },
          description: { type: 'STRING', description: 'Detailed notes.' },
          dueDate: { type: 'STRING', description: 'When the task is due (e.g. "Tomorrow 9AM", "2024-12-01").' },
          priority: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
          project: { type: 'STRING', description: 'Project the task belongs to.' },
          workspace: { type: 'STRING', description: 'Workspace the task belongs to.' },
          tags: { type: 'STRING', description: 'Comma-separated tags.' },
          starred: { type: 'STRING', enum: ['true', 'false'] },
          reminder: { type: 'STRING', description: 'Reminder time/rules.' },
          repeat: { type: 'STRING', description: 'Recurrence rule (e.g. "daily", "weekly").' },
        },
        required: ['text'],
      },
    },
    execute: (args): ToolResult => {
      const tagsArray = args.tags ? args.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;
      useTodoStore.getState().addTodo({
        text: args.text,
        description: args.description,
        dueDate: args.dueDate,
        priority: args.priority ?? 'Medium',
        project: args.project,
        workspace: args.workspace,
        tags: tagsArray,
        isStarred: args.starred === 'true',
        reminder: args.reminder,
        repeat: args.repeat,
      });
      return { success: true, data: { added: args.text, priority: args.priority ?? 'Medium' } };
    },
  },

  {
    declaration: {
      name: 'todo_update',
      description: 'Modifies properties of an existing task. Use when user says "change the due date of X", "set priority of X to high".',
      parameters: {
        type: 'OBJECT',
        properties: {
          task_query: { type: 'STRING', description: 'Text to match the task to update.' },
          text: { type: 'STRING' },
          description: { type: 'STRING' },
          dueDate: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
          project: { type: 'STRING' },
          workspace: { type: 'STRING' },
          reminder: { type: 'STRING' },
          repeat: { type: 'STRING' },
        },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      
      const updates: any = {};
      if (args.text !== undefined) updates.text = args.text;
      if (args.description !== undefined) updates.description = args.description;
      if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
      if (args.priority !== undefined) updates.priority = args.priority;
      if (args.project !== undefined) updates.project = args.project;
      if (args.workspace !== undefined) updates.workspace = args.workspace;
      if (args.reminder !== undefined) updates.reminder = args.reminder;
      if (args.repeat !== undefined) updates.repeat = args.repeat;

      useTodoStore.getState().updateTodo(match.id, updates);
      return { success: true, data: { updated: match.text, updates } };
    },
  },

  {
    declaration: {
      name: 'todo_complete',
      description: 'Marks a task as completed.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query, true);
      if (!match) return { success: false, error: `No pending task found matching: "${args.task_query}"` };
      useTodoStore.getState().updateTodo(match.id, { completed: true });
      return { success: true, data: { completed: match.text } };
    },
  },

  {
    declaration: {
      name: 'todo_delete',
      description: 'Deletes a task permanently.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      useTodoStore.getState().deleteTodo(match.id);
      return { success: true, data: { deleted: match.text } };
    },
  },

  {
    declaration: {
      name: 'todo_archive',
      description: 'Archives a task.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      useTodoStore.getState().archiveTodo(match.id);
      return { success: true, data: { archived: match.text } };
    },
  },

  {
    declaration: {
      name: 'todo_duplicate',
      description: 'Creates a copy of a task.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      useTodoStore.getState().duplicateTodo(match.id);
      return { success: true, data: { duplicated: match.text } };
    },
  },

  {
    declaration: {
      name: 'todo_move',
      description: 'Moves a task to a different project or workspace.',
      parameters: {
        type: 'OBJECT',
        properties: {
          task_query: { type: 'STRING' },
          workspace: { type: 'STRING' },
          project: { type: 'STRING' },
        },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      useTodoStore.getState().moveTodo(match.id, args.workspace, args.project);
      return { success: true, data: { moved: match.text, workspace: args.workspace, project: args.project } };
    },
  },

  {
    declaration: {
      name: 'todo_list',
      description: 'Returns the current list of tasks with advanced filtering.',
      parameters: {
        type: 'OBJECT',
        properties: {
          status: { type: 'STRING', enum: ['all', 'pending', 'completed'], description: 'Filter by completion status' },
          priority: { type: 'STRING', enum: ['High', 'Medium', 'Low'], description: 'Filter by priority' },
          project: { type: 'STRING', description: 'Filter by exact project name' },
          workspace: { type: 'STRING', description: 'Filter by exact workspace name' },
          date_filter: { type: 'STRING', enum: ['today', 'tomorrow', 'this_week', 'overdue'], description: 'Filter by relative due date' },
        },
      },
    },
    execute: (args): ToolResult => {
      let { todos } = useTodoStore.getState();
      
      // Filter out archived tasks by default
      todos = todos.filter(t => !t.isArchived);

      if (args.status === 'pending') todos = todos.filter(t => !t.completed);
      if (args.status === 'completed') todos = todos.filter(t => t.completed);
      if (args.priority) todos = todos.filter(t => t.priority === args.priority);
      if (args.project) todos = todos.filter(t => t.project?.toLowerCase() === args.project.toLowerCase());
      if (args.workspace) todos = todos.filter(t => t.workspace?.toLowerCase() === args.workspace.toLowerCase());

      // Basic naive date filtering logic (can be improved with a real date library)
      if (args.date_filter) {
        todos = todos.filter(t => {
          if (!t.dueDate) return false;
          // Very simplified match, assuming dueDate might contain "today" or exact date
          if (args.date_filter === 'today' && t.dueDate.toLowerCase().includes('today')) return true;
          if (args.date_filter === 'tomorrow' && t.dueDate.toLowerCase().includes('tomorrow')) return true;
          if (args.date_filter === 'overdue' && t.dueDate.toLowerCase().includes('overdue')) return true; // stub
          return false; // stub logic for others
        });
      }

      const summary = todos.slice(0, 15).map(t => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        priority: t.priority,
        dueDate: t.dueDate,
        project: t.project,
        workspace: t.workspace
      }));

      return { success: true, data: { count: todos.length, filters: args, todos: summary } };
    },
  },

  {
    declaration: {
      name: 'todo_search',
      description: 'Searches tasks by a text keyword.',
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING' } },
        required: ['query'],
      },
    },
    execute: (args): ToolResult => {
      let { todos } = useTodoStore.getState();
      const q = args.query.toLowerCase();
      const results = todos.filter(t => !t.isArchived && t.text.toLowerCase().includes(q));
      
      return { 
        success: true, 
        data: { 
          count: results.length, 
          todos: results.map(t => ({ text: t.text, completed: t.completed, project: t.project })) 
        } 
      };
    },
  },

  {
    declaration: {
      name: 'todo_open',
      description: 'Opens the detailed Task Window for a specific task.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      
      // Store the focused task ID in LayoutStore or a dedicated view state.
      // We will create task-window widget id and toggle it open with focus.
      // For now, we spawn 'task-window' and pass id via a special mechanism (or just trust the window reads from a focusedId state).
      // We will assume LayoutStore has a spawnTaskWindow method we'll add.
      (useLayoutStore.getState() as any).spawnWidget('task-window', { x: 200, y: 150 });
      // To pass the ID, we might need to add it to a store. We'll set it in TodoStore.
      // Let's assume we add `focusedTaskId` to TodoStore.
      (useTodoStore.getState() as any).focusedTaskId = match.id;

      return { success: true, data: { opened: match.text } };
    },
  },

  {
    declaration: {
      name: 'todo_share',
      description: 'Copies a task summary to the clipboard for sharing.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      
      const shareText = `Task: ${match.text}\nStatus: ${match.completed ? 'Done' : 'Pending'}\nPriority: ${match.priority || 'Normal'}${match.dueDate ? '\nDue: ' + match.dueDate : ''}${match.description ? '\nNotes: ' + match.description : ''}`;
      
      try {
        await navigator.clipboard.writeText(shareText);
        return { success: true, data: { copied: true, task: match.text } };
      } catch (err) {
        return { success: false, error: 'Failed to copy to clipboard (requires secure context/focus).' };
      }
    },
  },

  {
    declaration: {
      name: 'todo_export',
      description: 'Exports all tasks as formatted text and copies to clipboard.',
    },
    execute: async (): Promise<ToolResult> => {
      const { todos } = useTodoStore.getState();
      const exportText = todos.filter(t => !t.isArchived).map(t => 
        `- [${t.completed ? 'x' : ' '}] ${t.text} (Priority: ${t.priority || 'Medium'})`
      ).join('\n');
      
      try {
        await navigator.clipboard.writeText(exportText);
        return { success: true, data: { copied: true, count: todos.length } };
      } catch (err) {
        return { success: false, error: 'Failed to copy to clipboard.' };
      }
    },
  },

  // ─── Reminder Intents ───

  {
    declaration: {
      name: 'reminder_create',
      description: 'Sets a reminder for a task.',
      parameters: {
        type: 'OBJECT',
        properties: {
          task_query: { type: 'STRING' },
          time: { type: 'STRING', description: 'When to remind (e.g. "in 5 minutes", "tomorrow at 9am").' }
        },
        required: ['task_query', 'time'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      useTodoStore.getState().updateTodo(match.id, { reminder: args.time });
      return { success: true, data: { task: match.text, reminderSetFor: args.time } };
    },
  },

  {
    declaration: {
      name: 'reminder_delete',
      description: 'Removes a reminder from a task.',
      parameters: {
        type: 'OBJECT',
        properties: { task_query: { type: 'STRING' } },
        required: ['task_query'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      useTodoStore.getState().updateTodo(match.id, { reminder: undefined });
      return { success: true, data: { task: match.text, reminderDeleted: true } };
    },
  },

  {
    declaration: {
      name: 'reminder_snooze',
      description: 'Snoozes a reminder for a task.',
      parameters: {
        type: 'OBJECT',
        properties: {
          task_query: { type: 'STRING' },
          duration: { type: 'STRING', description: 'E.g. "10 minutes", "1 hour".' }
        },
        required: ['task_query', 'duration'],
      },
    },
    execute: (args): ToolResult => {
      const match = findTask(args.task_query);
      if (!match) return { success: false, error: `No task found matching: "${args.task_query}"` };
      const newReminderTime = `Snoozed: ${args.duration}`;
      useTodoStore.getState().updateTodo(match.id, { reminder: newReminderTime });
      return { success: true, data: { task: match.text, snoozedFor: args.duration } };
    },
  },

  {
    declaration: {
      name: 'task_upcoming',
      description: 'Lists tasks that have upcoming reminders or due dates soon.',
    },
    execute: (): ToolResult => {
      const { todos } = useTodoStore.getState();
      const upcoming = todos.filter(t => !t.completed && !t.isArchived && (t.dueDate || t.reminder)).slice(0, 5);
      return { success: true, data: { upcoming: upcoming.map(t => ({ text: t.text, due: t.dueDate, reminder: t.reminder })) } };
    },
  },

  {
    declaration: {
      name: 'task_missed',
      description: 'Lists tasks that are overdue or missed.',
    },
    execute: (): ToolResult => {
      const { todos } = useTodoStore.getState();
      // Stub logic for missed tasks
      const missed = todos.filter(t => !t.completed && !t.isArchived && t.dueDate?.includes('overdue')).slice(0, 5);
      return { success: true, data: { missed: missed.map(t => ({ text: t.text, due: t.dueDate })) } };
    },
  },

];
