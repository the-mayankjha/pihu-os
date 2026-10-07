import { create } from 'zustand';

export interface ActiveProjectInfo {
  name: string;
  dir: string;
  port: number;
  url: string;
  category?: string;
  lastUpdated: number;
}

export interface PendingFileChange {
  path: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
  language?: string;
}

export interface PendingProjectAction {
  id: string;
  type: 'scaffold_project' | 'create_react_project' | 'edit_files' | 'execute_command';
  title: string;
  description?: string;
  targetDir: string;
  files: PendingFileChange[];
  command?: string;
  createdAt: number;
}

export interface PendingEmailAction {
  id: string;
  to: string;
  toEmail: string;
  subject: string;
  body: string;
  createdAt: number;
}

export interface PendingWhatsAppAction {
  id: string;
  recipient: {
    jid: string;
    displayName: string;
    phone: string;
  };
  message: string;
  createdAt: number;
}

interface VoiceState {
  isActive: boolean;
  isListening: boolean;
  transcription: string;
  response: string;
  processingStatus: string | null;
  activeProject: ActiveProjectInfo | null;
  pendingProjectAction: PendingProjectAction | null;
  pendingEmailAction: PendingEmailAction | null;
  pendingWhatsAppAction: PendingWhatsAppAction | null;
  isCommandPaletteOpen: boolean;
  activeVoiceEngine: string;
  activeVoiceName: string | null;
  lastTTSError: string | null;

  setIsActive: (active: boolean) => void;
  setIsListening: (listening: boolean) => void;
  setTranscription: (text: string) => void;
  setResponse: (text: string) => void;
  setProcessingStatus: (status: string | null) => void;
  setActiveProject: (project: ActiveProjectInfo | null) => void;
  setPendingProjectAction: (action: PendingProjectAction | null) => void;
  setPendingEmailAction: (action: PendingEmailAction | null) => void;
  updatePendingEmailAction: (updates: Partial<PendingEmailAction>) => void;
  setPendingWhatsAppAction: (action: PendingWhatsAppAction | null) => void;
  updatePendingWhatsAppAction: (updates: Partial<PendingWhatsAppAction>) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setActiveVoiceEngine: (engine: string) => void;
  setActiveVoiceName: (name: string | null) => void;
  setLastTTSError: (err: string | null) => void;
  reset: () => void;
}

// Initial active project from localStorage if available
const savedProject = localStorage.getItem('pihu_active_project');
const initialActiveProject: ActiveProjectInfo | null = savedProject ? JSON.parse(savedProject) : null;

export const useVoiceStore = create<VoiceState>((set) => ({
  isActive: false,
  isListening: false,
  transcription: '',
  response: '',
  processingStatus: null,
  activeProject: initialActiveProject,
  pendingProjectAction: null,
  pendingEmailAction: null,
  pendingWhatsAppAction: null,
  isCommandPaletteOpen: false,
  activeVoiceEngine: 'Awaiting Engine...',
  activeVoiceName: null,
  lastTTSError: null,

  setIsActive: (active) => set({ isActive: active }),
  setIsListening: (listening) => set({ isListening: listening }),
  setTranscription: (text) => set({ transcription: text }),
  setResponse: (text) => set({ response: text }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setActiveProject: (project) => {
    if (project) {
      localStorage.setItem('pihu_active_project', JSON.stringify(project));
    }
    set({ activeProject: project });
  },
  setPendingProjectAction: (action) => set({ pendingProjectAction: action }),
  setPendingEmailAction: (action) => set({ pendingEmailAction: action }),
  updatePendingEmailAction: (updates) => set((state) => ({
    pendingEmailAction: state.pendingEmailAction ? { ...state.pendingEmailAction, ...updates } : null,
  })),
  setPendingWhatsAppAction: (action) => set({ pendingWhatsAppAction: action }),
  updatePendingWhatsAppAction: (updates) => set((state) => ({
    pendingWhatsAppAction: state.pendingWhatsAppAction ? { ...state.pendingWhatsAppAction, ...updates } : null,
  })),
  setIsCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  setActiveVoiceEngine: (engine) => set({ activeVoiceEngine: engine }),
  setActiveVoiceName: (name) => set({ activeVoiceName: name }),
  setLastTTSError: (err) => set({ lastTTSError: err }),

  reset: () => set({
    isActive: false,
    isListening: false,
    transcription: '',
    response: '',
    processingStatus: null,
    pendingProjectAction: null,
    pendingEmailAction: null,
    pendingWhatsAppAction: null,
    activeVoiceEngine: 'Awaiting Engine...',
    activeVoiceName: null,
    lastTTSError: null
  }),
}));
