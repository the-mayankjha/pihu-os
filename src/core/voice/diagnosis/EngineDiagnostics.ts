import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useVoiceStore } from '../../../stores/voiceStore';

export interface ServiceDiagnosis {
  name: string;
  online: boolean;
  latencyMs: number | null;
  statusText: string;
  error: string | null;
  details?: string;
}

export interface EngineDiagnosticsState {
  bundle: { ok: boolean; checks: { name: string; ok: boolean; detail: string }[] } | null;
  isDiagnosing: boolean;
  lastDiagnosedAt: number | null;
  
  // STT status
  stt: {
    activeEngine: 'whisper' | 'gemini_live';
    isFallback: boolean;
    whisper: ServiceDiagnosis;
    geminiLive: ServiceDiagnosis;
    error: string | null;
  };

  // TTS status
  tts: {
    activeEngine: 'kokoro' | 'sarvam' | 'elevenlabs' | 'native';
    isFallback: boolean;
    kokoro: ServiceDiagnosis;
    sarvam: ServiceDiagnosis;
    elevenLabs: ServiceDiagnosis;
    native: ServiceDiagnosis;
    error: string | null;
  };

  // WakeWord status
  wakeWord: {
    online: boolean;
    modelsCount: number;
    models: string[];
    error: string | null;
  };

  runDiagnosis: () => Promise<void>;
}

export const useDiagnosticsStore = create<EngineDiagnosticsState>((set, get) => ({
  bundle: null,
  isDiagnosing: false,
  lastDiagnosedAt: null,

  stt: {
    activeEngine: 'whisper',
    isFallback: false,
    whisper: {
      name: 'Whisper.cpp GGML (Local)',
      online: false,
      latencyMs: null,
      statusText: 'Initializing...',
      error: null,
      details: 'ws://127.0.0.1:5001'
    },
    geminiLive: {
      name: 'Gemini Live STT (Cloud)',
      online: false,
      latencyMs: null,
      statusText: 'Checking...',
      error: null,
      details: 'Google Gemini 2.5 Flash Multimodal Speech'
    },
    error: null,
  },

  tts: {
    activeEngine: 'kokoro',
    isFallback: false,
    kokoro: {
      name: 'Kokoro Neural Synthesizer (Local)',
      online: false,
      latencyMs: null,
      statusText: 'Initializing...',
      error: null,
      details: 'Port 48126 (hf_alpha / af_bella)'
    },
    sarvam: {
      name: 'Sarvam AI Bulbul (Cloud)',
      online: false,
      latencyMs: null,
      statusText: 'Checking...',
      error: null,
      details: 'Speaker: aarti_hi_customer (hi-IN)'
    },
    elevenLabs: {
      name: 'ElevenLabs Multilingual (Cloud)',
      online: false,
      latencyMs: null,
      statusText: 'Checking...',
      error: null,
    },
    native: {
      name: 'System SpeechSynthesis (Native)',
      online: false,
      latencyMs: null,
      statusText: 'Not checked',
      error: null,
    },
    error: null,
  },

  wakeWord: {
    online: false,
    modelsCount: 0,
    models: [],
    error: null,
  },

  runDiagnosis: async () => {
    if (get().isDiagnosing) return;
    set({ isDiagnosing: true });

    const runtimePromise = invoke<{ ok: boolean; checks: { name: string; ok: boolean; detail: string }[]; wakeWord: { online: boolean; error: string | null } }>('diagnose_runtime').catch(error => ({
      ok: false, checks: [{ name: 'Bundled runtime', ok: false, detail: String(error) }],
      wakeWord: { online: false, error: String(error) }
    }));
    const nativeAvailable = typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices().length > 0;
    const settings = useSettingsStore.getState();

    // ──────────────── 1. Probe Whisper WebSocket STT ────────────────
    const probeWhisper = async (): Promise<ServiceDiagnosis> => {
      const startTime = performance.now();
      try {
        const wsAvailable = await new Promise<boolean>((resolve) => {
          let resolved = false;
          let ws: WebSocket | null = null;
          try {
            ws = new WebSocket('ws://127.0.0.1:5001');
          } catch {
            return resolve(false);
          }
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              try { ws?.close(); } catch {}
              resolve(false);
            }
          }, 1800);

          ws.onopen = () => ws?.send(JSON.stringify({ type: 'diagnostics' }));
          ws.onmessage = event => {
            try {
              const data = JSON.parse(event.data);
              if (!resolved && data.type === 'diagnostics' && data.service === 'pihu-stt') {
                resolved = true;
                clearTimeout(timer);
                ws?.close();
                resolve(data.ready === true);
              }
            } catch { /* Wait for a valid PIHU service response. */ }
          };
          ws.onerror = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(false);
            }
          };
        });

        const elapsed = Math.round(performance.now() - startTime);
        if (wsAvailable) {
          return {
            name: 'Whisper.cpp Small (Hindi + English)',
            online: true,
            latencyMs: elapsed,
            statusText: `Online (${elapsed}ms)`,
            error: null,
            details: 'Local C++ ws://127.0.0.1:5001'
          };
        } else {
          return {
            name: 'Whisper.cpp Small (Hindi + English)',
            online: false,
            latencyMs: null,
            statusText: 'Offline',
            error: 'STT WebSocket (ws://127.0.0.1:5001) not responding. Python STT server might not be running.',
            details: 'Local C++ ws://127.0.0.1:5001'
          };
        }
      } catch (e: any) {
        return {
          name: 'Whisper.cpp Small (Hindi + English)',
          online: false,
          latencyMs: null,
          statusText: 'Offline',
          error: e.message || String(e),
          details: 'Local C++ ws://127.0.0.1:5001'
        };
      }
    };

    // ──────────────── 2. Probe Gemini Cloud STT ────────────────
    const probeGemini = async (): Promise<ServiceDiagnosis> => {
      const geminiKeys = settings.geminiApiKeys;
      const key = geminiKeys.length > 0 ? geminiKeys[settings.activeKeyIndex] || geminiKeys[0] : (import.meta.env.VITE_GEMINI_API_KEYS || '').split(',')[0]?.trim();
      if (!key) {
        return {
          name: 'Gemini Live STT API',
          online: false,
          latencyMs: null,
          statusText: 'Missing Key',
          error: 'No Gemini API Key found in settings or .env',
          details: 'Google Generative AI'
        };
      }
      const startTime = performance.now();
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${key}`, {
          signal: AbortSignal.timeout(3500)
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (res.ok) {
          return {
            name: 'Gemini Live STT API',
            online: true,
            latencyMs: elapsed,
            statusText: `Ready (${elapsed}ms)`,
            error: null,
            details: 'Gemini 2.5 Flash Audio STT Cloud Fallback'
          };
        } else {
          return {
            name: 'Gemini Live STT API',
            online: false,
            latencyMs: elapsed,
            statusText: `HTTP ${res.status}`,
            error: `Gemini API returned HTTP ${res.status}`,
            details: 'Google Generative AI'
          };
        }
      } catch (e: any) {
        return {
          name: 'Gemini Live STT API',
          online: false,
          latencyMs: null,
          statusText: 'Network Error',
          error: e.message || 'Cannot reach Google Gemini API endpoint',
          details: 'Google Generative AI'
        };
      }
    };

    // ──────────────── 3. Probe Kokoro Local TTS ────────────────
    const probeKokoro = async (): Promise<ServiceDiagnosis> => {
      const startTime = performance.now();
      try {
        const res = await fetch('http://127.0.0.1:48126/health', {
          signal: AbortSignal.timeout(2000)
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const ready = data.service === 'pihu-tts' && data.status === 'ready' && data.hindi_ready === true && data.english_ready === true;
          return {
            name: 'Kokoro Neural Synthesizer',
            online: ready,
            latencyMs: elapsed,
            statusText: ready ? `Ready (${elapsed}ms)` : 'Initializing...',
            error: ready ? null : 'Kokoro model pipelines still initializing',
            details: `Port 48126 ${data.hindi_ready ? '+ Hindi' : ''} ${data.english_ready ? '+ English' : ''}`
          };
        } else {
          return {
            name: 'Kokoro Neural Synthesizer',
            online: false,
            latencyMs: elapsed,
            statusText: 'Offline',
            error: `Flask TTS daemon responded with HTTP ${res.status}`,
            details: 'Port 48126'
          };
        }
      } catch (e: any) {
        return {
          name: 'Kokoro Neural Synthesizer',
          online: false,
          latencyMs: null,
          statusText: 'Offline',
          error: 'Connection refused on port 48126. Kokoro Python daemon is not active.',
          details: 'Port 48126'
        };
      }
    };

    // ──────────────── 4. Probe Sarvam AI TTS ────────────────
    const probeSarvam = async (): Promise<ServiceDiagnosis> => {
      const sarvamKey = settings.sarvamApiKey || (import.meta.env.VITE_SARVAM_API_KEY as string) || '';
      if (!sarvamKey) {
        return {
          name: 'Sarvam AI (Aarti hi-IN)',
          online: false,
          latencyMs: null,
          statusText: 'Missing Key',
          error: 'SARVAM_API_KEY is not configured',
          details: 'speaker: aarti_hi_customer'
        };
      }
      const startTime = performance.now();
      try {
        // Quick validate preflight with a single word
        const res = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': sarvamKey,
          },
          body: JSON.stringify({
            text: 'नमस्ते',
            language_code: settings.sarvamLanguageCode || 'hi-IN',
            speaker: settings.sarvamSpeaker || 'aarti_hi_customer',
            model: 'bulbul:v4-flash'
          }),
          signal: AbortSignal.timeout(4000)
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (res.ok) {
          return {
            name: 'Sarvam AI (Aarti hi-IN)',
            online: true,
            latencyMs: elapsed,
            statusText: `Ready (${elapsed}ms)`,
            error: null,
            details: `bulbul:v4-flash | ${settings.sarvamSpeaker || 'aarti_hi_customer'}`
          };
        } else {
          const errBody = await res.text().catch(() => '');
          return {
            name: 'Sarvam AI (Aarti hi-IN)',
            online: false,
            latencyMs: elapsed,
            statusText: `HTTP ${res.status}`,
            error: `Sarvam API error: HTTP ${res.status} ${errBody.slice(0, 80)}`,
            details: 'speaker: aarti_hi_customer'
          };
        }
      } catch (e: any) {
        return {
          name: 'Sarvam AI (Aarti hi-IN)',
          online: false,
          latencyMs: null,
          statusText: 'Network Timeout',
          error: e.message || 'Could not connect to Sarvam AI API',
          details: 'speaker: aarti_hi_customer'
        };
      }
    };

    // ──────────────── 5. Probe ElevenLabs ────────────────
    const probeElevenLabs = async (): Promise<ServiceDiagnosis> => {
      const apiKey = settings.elevenLabsApiKey || import.meta.env.VITE_ELEVENLABS_API_KEY;
      if (!apiKey) {
        return {
          name: 'ElevenLabs Multilingual',
          online: false,
          latencyMs: null,
          statusText: 'Unconfigured',
          error: 'No ElevenLabs API Key set',
          details: 'Cloud TTS'
        };
      }
      return {
        name: 'ElevenLabs Multilingual',
        online: true,
        latencyMs: null,
        statusText: 'Configured',
        error: null,
        details: `Voice ID: ${settings.elevenLabsVoiceId}`
      };
    };

    // Execute probes in parallel
    const [whisperRes, geminiRes, kokoroRes, sarvamRes, elevenLabsRes] = await Promise.all([
      probeWhisper(),
      probeGemini(),
      probeKokoro(),
      probeSarvam(),
      probeElevenLabs()
    ]);

    const runtime = await runtimePromise;
    // ──────────────── Resolve STT Active & Fallback ────────────────
    let sttActive: 'whisper' | 'gemini_live' = 'whisper';
    let sttIsFallback = false;
    let sttError: string | null = null;

    if (settings.sttEnginePreference === 'gemini_live') {
      sttActive = 'gemini_live';
      if (!geminiRes.online) sttError = geminiRes.error;
    } else if (settings.sttEnginePreference === 'whisper') {
      sttActive = 'whisper';
      if (!whisperRes.online) sttError = whisperRes.error;
    } else {
      // Auto fallback
      if (whisperRes.online) {
        sttActive = 'whisper';
      } else if (geminiRes.online) {
        sttActive = 'gemini_live';
        sttIsFallback = true;
        sttError = `Whisper local STT is offline (${whisperRes.error || 'Connection failed'}). Active fallback: Gemini Live API.`;
      } else {
        sttActive = 'whisper';
        sttError = 'Both local Whisper and Gemini Cloud STT are unavailable.';
      }
    }

    // ──────────────── Resolve TTS Active & Fallback ────────────────
    let ttsActive: 'kokoro' | 'sarvam' | 'elevenlabs' | 'native' = 'kokoro';
    let ttsIsFallback = false;
    let ttsError: string | null = null;

    if (settings.ttsEnginePreference === 'kokoro') {
      ttsActive = 'kokoro';
      if (!kokoroRes.online) ttsError = kokoroRes.error;
    } else if (settings.ttsEnginePreference === 'sarvam') {
      ttsActive = 'sarvam';
      if (!sarvamRes.online) ttsError = sarvamRes.error;
    } else if (settings.ttsEnginePreference === 'elevenlabs') {
      ttsActive = 'elevenlabs';
      if (!elevenLabsRes.online) ttsError = elevenLabsRes.error;
    } else if (settings.ttsEnginePreference === 'native') {
      ttsActive = 'native';
    } else {
      // Auto fallback: Kokoro -> Sarvam AI -> ElevenLabs -> Native
      if (kokoroRes.online) {
        ttsActive = 'kokoro';
      } else if (sarvamRes.online) {
        ttsActive = 'sarvam';
        ttsIsFallback = true;
        ttsError = `Kokoro TTS is offline (${kokoroRes.error || 'Port 48126 unreachable'}). Active fallback: Sarvam AI (Aarti hi-IN).`;
      } else if (elevenLabsRes.online) {
        ttsActive = 'elevenlabs';
        ttsIsFallback = true;
        ttsError = `Kokoro & Sarvam AI offline. Active fallback: ElevenLabs.`;
      } else {
        ttsActive = 'native';
        ttsIsFallback = true;
        ttsError = `Local AI & Cloud TTS offline. Active fallback: System Native Speech.`;
      }
    }

    // Update voiceStore active engine label
    const voiceEngineLabel = ttsActive === 'kokoro' 
      ? 'Kokoro Neural (Port 48126)' 
      : ttsActive === 'sarvam' 
      ? 'Sarvam AI (Aarti hi-IN)' 
      : ttsActive === 'elevenlabs' 
      ? 'ElevenLabs Multilingual' 
      : 'System Native Speech';
    useVoiceStore.getState().setActiveVoiceEngine(voiceEngineLabel);
    useVoiceStore.getState().setLastTTSError(ttsError);

    set({
      isDiagnosing: false,
      bundle: runtime,
      lastDiagnosedAt: Date.now(),
      stt: {
        activeEngine: sttActive,
        isFallback: sttIsFallback,
        whisper: whisperRes,
        geminiLive: geminiRes,
        error: sttError,
      },
      tts: {
        activeEngine: ttsActive,
        isFallback: ttsIsFallback,
        kokoro: kokoroRes,
        sarvam: sarvamRes,
        elevenLabs: elevenLabsRes,
        native: {
          name: 'System SpeechSynthesis (Native)',
          online: nativeAvailable,
          latencyMs: null,
          statusText: nativeAvailable ? 'Available' : 'Unavailable',
          error: nativeAvailable ? null : 'No system speech voices available',
          details: 'Web Speech API'
        },
        error: ttsError,
      },
      wakeWord: {
        online: runtime.wakeWord.online,
        modelsCount: runtime.checks.filter(c => c.name.startsWith('Wake model:') && c.ok).length,
        models: runtime.checks.filter(c => c.name.startsWith('Wake model:') && c.ok).map(c => c.name.slice(12)),
        error: runtime.wakeWord.error,
      }
    });
  }
}));
