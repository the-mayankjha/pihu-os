import { create } from 'zustand';

export interface CodeExecutionResult {
  id: string;
  language: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: number;
  fileName?: string;
  projectName?: string;
}

interface CodeOutputState {
  isOpen: boolean;
  activeExecution: CodeExecutionResult | null;
  history: CodeExecutionResult[];
  isRunning: boolean;

  setIsOpen: (open: boolean) => void;
  setActiveExecution: (result: CodeExecutionResult | null) => void;
  setIsRunning: (running: boolean) => void;
  addExecution: (result: CodeExecutionResult) => void;
  clearHistory: () => void;
}

export const useCodeOutputStore = create<CodeOutputState>((set) => ({
  isOpen: false,
  activeExecution: null,
  history: [],
  isRunning: false,

  setIsOpen: (open) => set({ isOpen: open }),
  setActiveExecution: (result) => set({ activeExecution: result, isOpen: !!result }),
  setIsRunning: (running) => set({ isRunning: running }),
  addExecution: (result) => set((state) => ({
    activeExecution: result,
    isOpen: true,
    history: [result, ...state.history.slice(0, 19)],
    isRunning: false,
  })),
  clearHistory: () => set({ history: [], activeExecution: null }),
}));
