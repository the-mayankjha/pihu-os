import { create } from 'zustand';
import { OrbState } from '../../shared/components/Orb/states';

interface OrbStoreState {
  currentState: OrbState;
  size: number;
  setState: (state: OrbState) => void;
  setSize: (size: number) => void;
}

export const useOrbStore = create<OrbStoreState>((set) => ({
  currentState: OrbState.IDLE,
  size: 160,
  setState: (state) => set({ currentState: state }),
  setSize: (size) => set({ size }),
}));
