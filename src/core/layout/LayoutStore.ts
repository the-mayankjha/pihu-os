import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetState {
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
}

interface LayoutState {
  widgets: Record<string, WidgetState>;
  isWidgetDrawerOpen: boolean;
  updateWidgetPosition: (id: string, position: { x: number; y: number }) => void;
  updateWidgetSize: (id: string, size: { width: number | string; height: number | string }) => void;
  toggleWidget: (id: string) => void;
  spawnWidget: (id: string, position: { x: number; y: number }) => void;
  toggleWidgetDrawer: () => void;
  registerWidget: (id: string, defaultPosition: { x: number; y: number }, defaultSize: { width: number | string; height: number | string }) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgets: {},
      isWidgetDrawerOpen: false,

      toggleWidgetDrawer: () => set((state) => ({ isWidgetDrawerOpen: !state.isWidgetDrawerOpen })),

      spawnWidget: (id, position) => {
        set((state) => ({
          widgets: {
            ...state.widgets,
            [id]: {
              ...(state.widgets[id] || { size: { width: 'auto', height: 'auto' } }),
              isOpen: true,
              position,
            },
          },
        }));
      },

      updateWidgetPosition: (id, position) => {
        set((state) => ({
          widgets: {
            ...state.widgets,
            [id]: {
              ...(state.widgets[id] || { isOpen: true, size: { width: 'auto', height: 'auto' } }),
              position,
            },
          },
        }));
      },

      updateWidgetSize: (id, size) => {
        set((state) => ({
          widgets: {
            ...state.widgets,
            [id]: {
              ...(state.widgets[id] || { isOpen: true, position: { x: 0, y: 0 } }),
              size,
            },
          },
        }));
      },

      toggleWidget: (id) => {
        set((state) => {
          const widget = state.widgets[id];
          if (!widget) {
            return {
              widgets: {
                ...state.widgets,
                [id]: {
                  isOpen: true,
                  position: { x: 100, y: 100 },
                  size: { width: 'auto', height: 'auto' }
                }
              }
            };
          }
          return {
            widgets: {
              ...state.widgets,
              [id]: {
                ...widget,
                isOpen: !widget.isOpen,
              },
            },
          };
        });
      },

      registerWidget: (id, defaultPosition, defaultSize) => {
        // Only register if it doesn't already exist in the persisted store
        const state = get();
        if (!state.widgets[id]) {
          set((state) => ({
            widgets: {
              ...state.widgets,
              [id]: {
                isOpen: true,
                position: defaultPosition,
                size: defaultSize,
              },
            },
          }));
        }
      },
    }),
    {
      name: 'pihu-widget-layout-storage', // unique name for localStorage
    }
  )
);
