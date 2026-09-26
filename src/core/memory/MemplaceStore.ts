import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectMemoryEntry {
  name: string;
  dir: string;
  port?: number;
  url?: string;
  category?: string;
  lastActive: string;
  lastFile?: string;
  notes?: string;
  status: 'active' | 'completed' | 'paused';
}

export interface SessionContext {
  startTime: number;
  lastActiveTime: number;
  openFiles: string[];
  focusedApp: string;
  crashedFiles: string[];
  cleanShutdown: boolean;
}

interface MemplaceState {
  activeProject: ProjectMemoryEntry | null;
  projectHistory: ProjectMemoryEntry[];
  sessionContext: SessionContext;
  
  // Actions
  setActiveProject: (project: Partial<ProjectMemoryEntry> & { name: string; dir: string }) => void;
  addProjectToHistory: (project: ProjectMemoryEntry) => void;
  updateSessionActivity: (app?: string, openFile?: string) => void;
  recordFileCrash: (filePath: string) => void;
  markCleanShutdown: () => void;
  getContinuousWorkHours: () => number;
  getHealthWarning: () => string | null;
}

const INITIAL_SESSION: SessionContext = {
  startTime: Date.now(),
  lastActiveTime: Date.now(),
  openFiles: [],
  focusedApp: 'PIHU OS',
  crashedFiles: [],
  cleanShutdown: true,
};

export const useMemplaceStore = create<MemplaceState>()(
  persist(
    (set, get) => ({
      activeProject: null,
      projectHistory: [
        {
          name: 'pihu-web-test',
          dir: '/Users/mayankjha/Documents/projects/pihu-web-test',
          port: 5180,
          url: 'http://localhost:5180',
          category: 'react',
          lastActive: new Date().toISOString(),
          lastFile: 'src/App.tsx',
          status: 'active',
        },
      ],
      sessionContext: INITIAL_SESSION,

      setActiveProject: (projectData) => {
        const fullEntry: ProjectMemoryEntry = {
          name: projectData.name,
          dir: projectData.dir,
          port: projectData.port || 5180,
          url: projectData.url || `http://localhost:${projectData.port || 5180}`,
          category: projectData.category || 'react',
          lastActive: new Date().toISOString(),
          lastFile: projectData.lastFile || 'src/App.tsx',
          notes: projectData.notes || '',
          status: 'active',
        };

        const history = get().projectHistory.filter((p) => p.dir !== fullEntry.dir);

        set({
          activeProject: fullEntry,
          projectHistory: [fullEntry, ...history].slice(0, 50),
        });
      },

      addProjectToHistory: (project) => {
        const history = get().projectHistory.filter((p) => p.dir !== project.dir);
        set({ projectHistory: [project, ...history].slice(0, 50) });
      },

      updateSessionActivity: (app, openFile) => {
        const currentSession = get().sessionContext;
        const openFiles = [...currentSession.openFiles];
        if (openFile && !openFiles.includes(openFile)) {
          openFiles.push(openFile);
        }

        set({
          sessionContext: {
            ...currentSession,
            lastActiveTime: Date.now(),
            focusedApp: app || currentSession.focusedApp,
            openFiles: openFiles.slice(-10),
          },
        });

        // Also update active project last file if active
        const active = get().activeProject;
        if (active && openFile) {
          get().setActiveProject({
            ...active,
            lastFile: openFile,
            lastActive: new Date().toISOString(),
          });
        }
      },

      recordFileCrash: (filePath) => {
        const currentSession = get().sessionContext;
        set({
          sessionContext: {
            ...currentSession,
            crashedFiles: Array.from(new Set([...currentSession.crashedFiles, filePath])),
            cleanShutdown: false,
          },
        });
      },

      markCleanShutdown: () => {
        const currentSession = get().sessionContext;
        set({
          sessionContext: {
            ...currentSession,
            crashedFiles: [],
            cleanShutdown: true,
          },
        });
      },

      getContinuousWorkHours: () => {
        const startTime = get().sessionContext.startTime;
        const diffMs = Date.now() - startTime;
        return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1));
      },

      getHealthWarning: () => {
        const hours = get().getContinuousWorkHours();
        if (hours >= 6) {
          return `Sir, you have been working continuously for ${hours} hours. Please take a rest!`;
        }
        if (hours >= 2) {
          return `Sir, you have been working for ${hours} hours straight. Consider taking a short break!`;
        }
        return null;
      },
    }),
    {
      name: 'pihu_memplace_storage',
    }
  )
);
