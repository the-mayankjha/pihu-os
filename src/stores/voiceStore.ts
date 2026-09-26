import { create } from 'zustand';

export interface ActiveProjectInfo {
  name: string;
  dir: string;
  port: number;
  url: string;
  category?: string;
  lastUpdated: number;
}

interface VoiceState {
  isActive: boolean;
  isListening: boolean;
  transcription: string;
  response: string;
  processingStatus: string | null;
  activeProject: ActiveProjectInfo | null;
  activeVoiceEngine: string;
  activeVoiceName: string | null;
  lastTTSError: string | null;

  setIsActive: (active: boolean) => void;
  setIsListening: (listening: boolean) => void;
  setTranscription: (text: string) => void;
  setResponse: (text: string) => void;
  setProcessingStatus: (status: string | null) => void;
  setActiveProject: (project: ActiveProjectInfo | null) => void;
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
  setActiveVoiceEngine: (engine) => set({ activeVoiceEngine: engine }),
  setActiveVoiceName: (name) => set({ activeVoiceName: name }),
  setLastTTSError: (err) => set({ lastTTSError: err }),

  reset: () => set({
    isActive: false,
    isListening: false,
    transcription: '',
    response: '',
    processingStatus: null,
    activeVoiceEngine: 'Awaiting Engine...',
    activeVoiceName: null,
    lastTTSError: null
  }),
}));
