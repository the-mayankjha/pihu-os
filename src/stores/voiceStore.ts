import { create } from 'zustand';

interface VoiceState {
  isActive: boolean;
  isListening: boolean;
  transcription: string;
  response: string;
  activeVoiceEngine: string;
  
  setIsActive: (active: boolean) => void;
  setIsListening: (listening: boolean) => void;
  setTranscription: (text: string) => void;
  setResponse: (text: string) => void;
  setActiveVoiceEngine: (engine: string) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isActive: false,
  isListening: false,
  transcription: '',
  response: '',
  activeVoiceEngine: 'Awaiting Engine...',

  setIsActive: (active) => set({ isActive: active }),
  setIsListening: (listening) => set({ isListening: listening }),
  setTranscription: (text) => set({ transcription: text }),
  setResponse: (text) => set({ response: text }),
  setActiveVoiceEngine: (engine) => set({ activeVoiceEngine: engine }),
  
  reset: () => set({
    isActive: false,
    isListening: false,
    transcription: '',
    response: '',
    activeVoiceEngine: 'Awaiting Engine...'
  }),
}));
