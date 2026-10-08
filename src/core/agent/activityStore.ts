import { create } from 'zustand';

export type AgentActivity = 'idle' | 'thinking' | 'executing' | 'success' | 'error';
interface ActivityState {
  status: AgentActivity;
  runs: Record<string, 'thinking' | 'executing'>;
  begin: () => string;
  phase: (id: string, phase: 'thinking' | 'executing') => void;
  finish: (id: string, failed: boolean) => void;
}

let settleTimer: ReturnType<typeof setTimeout> | undefined;
const activeStatus = (runs: ActivityState['runs']): AgentActivity =>
  Object.values(runs).includes('executing') ? 'executing' : Object.keys(runs).length ? 'thinking' : 'idle';

export const useAgentActivityStore = create<ActivityState>((set) => ({
  status: 'idle', runs: {},
  begin: () => {
    clearTimeout(settleTimer);
    const id = crypto.randomUUID();
    set(state => ({ runs: { ...state.runs, [id]: 'executing' }, status: 'executing' }));
    return id;
  },
  phase: (id, phase) => set(state => {
    if (!(id in state.runs)) return state;
    const runs = { ...state.runs, [id]: phase };
    return { runs, status: activeStatus(runs) };
  }),
  finish: (id, failed) => {
    set(state => {
      if (!(id in state.runs)) return state;
      const runs = { ...state.runs };
      delete runs[id];
      return { runs, status: Object.keys(runs).length ? activeStatus(runs) : failed ? 'error' : 'success' };
    });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => set(state => Object.keys(state.runs).length ? state : { status: 'idle' }), 1800);
  },
}));
