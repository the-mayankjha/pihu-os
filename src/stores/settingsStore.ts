import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
  // PIHU Token Protocol (Gemini Keys)
  geminiApiKeys: string[];
  activeKeyIndex: number;
  exhaustedKeyIndices: number[];

  // Voice Engine Settings (ElevenLabs)
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;

  // Actions
  addGeminiKey: (key: string) => void;
  removeGeminiKey: (index: number) => void;
  setActiveKeyIndex: (index: number) => void;
  markKeyExhausted: (index: number) => void;
  resetExhaustedKeys: () => void;
  setElevenLabsConfig: (apiKey: string, voiceId: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      geminiApiKeys: [],
      activeKeyIndex: 0,
      exhaustedKeyIndices: [],
      elevenLabsApiKey: '',
      elevenLabsVoiceId: 'MmQVkVZnQ0dUbfWzcW6f',

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
    }),
    {
      name: 'pihu-settings-store',
    }
  )
);
