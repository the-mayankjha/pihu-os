import { create } from 'zustand';
import { useMemplaceStore, type ProjectMemoryEntry } from '../memory/MemplaceStore';
import { workspaceManager } from './WorkspaceManager';
import type { WorkspaceProject } from './workspaceTypes';

interface WorkspaceState {
  activeProject: WorkspaceProject | null;
  rememberedProjects: ProjectMemoryEntry[];
  defaultRoot: string;
  refreshProjects: () => void;
  openProject: (nameOrPath: string) => Promise<WorkspaceProject | null>;
  createProject: (name: string, template?: any, customDir?: string) => Promise<WorkspaceProject>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeProject: null,
  rememberedProjects: useMemplaceStore.getState().projectHistory,
  defaultRoot: '/Users/mayankjha/Documents/projects',

  refreshProjects: () => {
    set({ rememberedProjects: useMemplaceStore.getState().projectHistory });
  },

  openProject: async (nameOrPath) => {
    const proj = await workspaceManager.openProject(nameOrPath);
    if (proj) {
      set({
        activeProject: proj,
        rememberedProjects: useMemplaceStore.getState().projectHistory
      });
    }
    return proj;
  },

  createProject: async (name, template, customDir) => {
    const proj = await workspaceManager.createProject({ name, template, customDir });
    set({
      activeProject: proj,
      rememberedProjects: useMemplaceStore.getState().projectHistory
    });
    return proj;
  }
}));
