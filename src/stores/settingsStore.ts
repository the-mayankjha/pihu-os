import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GoogleAccount {
  email: string;
  name: string;
  picture?: string;
  isPrimary?: boolean;
  connectedAt: string;
}

export interface SettingsState {
  // PIHU Token Protocol (Gemini Keys)
  geminiApiKeys: string[];
  activeKeyIndex: number;
  exhaustedKeyIndices: number[];

  // Voice Engine Settings (ElevenLabs)
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;

  // Google Workspace Settings
  googleClientId: string;
  googleClientSecret: string;
  googleAccountConnected: boolean;
  connectedGoogleAccounts: GoogleAccount[];

  // Appearance & Workspace Preferences
  themeAccent: 'pink' | 'purple' | 'cyan' | 'emerald' | 'amber';
  blurIntensity: number;
  dockPosition: 'bottom' | 'left' | 'right';
  dockMagnification: boolean;
  soundEffects: boolean;
  focusModeActive: boolean;
  ttsSpeed: number;
  activeSidebarCategory: string;

  // Actions
  addGeminiKey: (key: string) => void;
  removeGeminiKey: (index: number) => void;
  setActiveKeyIndex: (index: number) => void;
  markKeyExhausted: (index: number) => void;
  resetExhaustedKeys: () => void;
  setElevenLabsConfig: (apiKey: string, voiceId: string) => void;
  setGoogleWorkspaceConfig: (clientId: string, clientSecret: string, connected?: boolean) => void;
  addConnectedGoogleAccount: (account: GoogleAccount) => void;
  removeConnectedGoogleAccount: (email: string) => void;
  setPrimaryGoogleAccount: (email: string) => void;
  setThemeAccent: (accent: 'pink' | 'purple' | 'cyan' | 'emerald' | 'amber') => void;
  setBlurIntensity: (val: number) => void;
  setDockPosition: (pos: 'bottom' | 'left' | 'right') => void;
  setDockMagnification: (enabled: boolean) => void;
  setSoundEffects: (enabled: boolean) => void;
  setFocusMode: (enabled: boolean) => void;
  setTtsSpeed: (speed: number) => void;
  setActiveSidebarCategory: (cat: string) => void;
}


export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      geminiApiKeys: [],
      activeKeyIndex: 0,
      exhaustedKeyIndices: [],
      elevenLabsApiKey: '',
      elevenLabsVoiceId: 'MmQVkVZnQ0dUbfWzcW6f',
      googleClientId: '',
      googleClientSecret: '',
      googleAccountConnected: false,
      connectedGoogleAccounts: [],
      themeAccent: 'pink',
      blurIntensity: 24,
      dockPosition: 'bottom',
      dockMagnification: true,
      soundEffects: true,
      focusModeActive: false,
      ttsSpeed: 1.0,
      activeSidebarCategory: 'ui-components',

      setThemeAccent: (accent) => set({ themeAccent: accent }),
      setBlurIntensity: (blurIntensity) => set({ blurIntensity }),
      setDockPosition: (dockPosition) => set({ dockPosition }),
      setDockMagnification: (dockMagnification) => set({ dockMagnification }),
      setSoundEffects: (soundEffects) => set({ soundEffects }),
      setFocusMode: (focusModeActive) => set({ focusModeActive }),
      setTtsSpeed: (ttsSpeed) => set({ ttsSpeed }),
      setActiveSidebarCategory: (activeSidebarCategory) => set({ activeSidebarCategory }),

      addGeminiKey: (key: string) => {
        const trimmed = key.trim();
        if (!trimmed) return;
        const current = get().geminiApiKeys;
        if (current.includes(trimmed)) return;
        set({ geminiApiKeys: [...current, trimmed] });
      },

      removeGeminiKey: (index: number) => {
        const current = get().geminiApiKeys;
        const updated = current.filter((_, i) => i !== index);
        const nextIndex = Math.max(0, Math.min(get().activeKeyIndex, updated.length - 1));
        const exhausted = get().exhaustedKeyIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i);
        set({
          geminiApiKeys: updated,
          activeKeyIndex: nextIndex,
          exhaustedKeyIndices: exhausted
        });
      },

      setActiveKeyIndex: (index: number) => {
        const keys = get().geminiApiKeys;
        if (index >= 0 && index < keys.length) {
          set({ activeKeyIndex: index });
        }
      },

      markKeyExhausted: (index: number) => {
        const exhausted = get().exhaustedKeyIndices;
        if (!exhausted.includes(index)) {
          const updated = [...exhausted, index];
          set({ exhaustedKeyIndices: updated });

          // Automatically pick next non-exhausted key
          const keys = get().geminiApiKeys;
          for (let i = 0; i < keys.length; i++) {
            const nextIdx = (index + 1 + i) % keys.length;
            if (!updated.includes(nextIdx)) {
              set({ activeKeyIndex: nextIdx });
              break;
            }
          }
        }
      },

      resetExhaustedKeys: () => set({ exhaustedKeyIndices: [] }),

      setElevenLabsConfig: (apiKey: string, voiceId: string) => set({
        elevenLabsApiKey: apiKey.trim(),
        elevenLabsVoiceId: voiceId.trim() || 'MmQVkVZnQ0dUbfWzcW6f'
      }),

      setGoogleWorkspaceConfig: (clientId: string, clientSecret: string, connected: boolean = true) => set({
        googleClientId: clientId.trim(),
        googleClientSecret: clientSecret.trim(),
        googleAccountConnected: connected
      }),

      addConnectedGoogleAccount: (account: GoogleAccount) => {
        const current = get().connectedGoogleAccounts;
        const existingIdx = current.findIndex(a => a.email.toLowerCase() === account.email.toLowerCase());
        let updated: GoogleAccount[];
        if (existingIdx >= 0) {
          updated = current.map((a, i) => i === existingIdx ? { ...a, ...account } : a);
        } else {
          const isFirst = current.length === 0;
          updated = [...current, { ...account, isPrimary: isFirst || account.isPrimary }];
        }
        set({
          connectedGoogleAccounts: updated,
          googleAccountConnected: updated.length > 0
        });
      },

      removeConnectedGoogleAccount: (email: string) => {
        const current = get().connectedGoogleAccounts;
        const updated = current.filter(a => a.email.toLowerCase() !== email.toLowerCase());
        if (updated.length > 0 && !updated.some(a => a.isPrimary)) {
          updated[0].isPrimary = true;
        }
        set({
          connectedGoogleAccounts: updated,
          googleAccountConnected: updated.length > 0
        });
      },

      setPrimaryGoogleAccount: (email: string) => {
        const current = get().connectedGoogleAccounts;
        const updated = current.map(a => ({
          ...a,
          isPrimary: a.email.toLowerCase() === email.toLowerCase()
        }));
        set({ connectedGoogleAccounts: updated });
      }

    }),
    {
      name: 'pihu-settings-storage',
    }
  )
);
