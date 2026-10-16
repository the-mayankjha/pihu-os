import { useSettingsStore } from '../../../stores/settingsStore';

// VAD thresholds (tuned for responsive speech interaction)
const SILENCE_AFTER_SPEECH_MS = 4000; // 4 seconds after speech to conclude sentence
const MIN_SPEECH_MS = 120;                   // A single click should not start an utterance.
const DEFAULT_IDLE_TIMEOUT_MS  = 6000;       // 6s with no speech at all → end session

function float32ToWavBlob(chunks: Float32Array[], sampleRate = 16000): Blob {
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = new ArrayBuffer(44 + totalLength * 2);
  const view = new DataView(buffer);

  const writeString = (v: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalLength * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, totalLength * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class STTManager {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording: boolean = false;
  private isConnecting: boolean = false;
  private captureWatchdog: ReturnType<typeof setInterval> | null = null;
  private lastAudioFrame = 0;
  private sessionGeneration = 0;
  private noiseFloor = 0.001;
  private speechCandidateMs = 0;

  // Browser-side VAD state
  private speechDetected: boolean = false;
  private silenceStart: number = 0;
  private sessionStart: number = 0;
  private vadTriggered: boolean = false;

  /** Configurable idle timeout per session (default 6s, set longer for follow-up). */
  public idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS;
  public speechStartThreshold = 0.008;
  public minimumSpeechMs = MIN_SPEECH_MS;
  public bufferUntilSpeech = false;
  private preSpeechFrames: Float32Array[] = [];
  private accumulatedSessionFrames: Float32Array[] = [];

  public onTranscription: ((text: string) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;
  public onIdleTimeout: (() => void) | null = null;
  public onSpeechStarted: (() => void) | null = null;

  constructor() {
    this.ensureConnected().catch(e =>
      console.warn('[SPEECH ENGINE - STT] Local Whisper ws://5001 offline. Gemini Live Cloud STT fallback ready:', e)
    );
  }

  public async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.isConnecting) {
      return new Promise<void>((resolve) => {
        const id = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN || !this.isConnecting) {
            clearInterval(id);
            resolve();
          }
        }, 50);
      }).then(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) throw new Error('STT server is unavailable');
      });
    }
    return this.connect();
  }

  private async connect(): Promise<void> {
    this.isConnecting = true;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('ws://127.0.0.1:5001');
      } catch (e) {
        this.isConnecting = false;
        reject(e);
        return;
      }
      const connectionTimeout = setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false;
          this.ws?.close();
          reject(new Error('STT connection timed out'));
        }
      }, 3500);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.log('[SPEECH ENGINE - STT] 🟢 Connected to Whisper STT WebSocket server (ws://5001)');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcription') {
            console.log(`[SPEECH ENGINE - STT] 📝 Transcription: "${data.text}"`);
            if (this.onTranscription) this.onTranscription(data.text);
          } else if (data.type === 'error') {
            console.error(`[SPEECH ENGINE - STT] ❌ Server Error: ${data.message}`);
            // Fall back to Gemini STT if Whisper reported an internal error
            this.transcribeWithGeminiFallback().catch(() => {
              if (this.onError) this.onError(data.message);
            });
          }
        } catch (e) {
          console.error('[SPEECH ENGINE - STT] ❌ Error parsing message:', e, event.data);
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.warn('[SPEECH ENGINE - STT] ⚠ Whisper WebSocket error (cloud fallback available)');
        reject(error);
      };

      this.ws.onclose = () => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.log('[SPEECH ENGINE - STT] 🔴 Whisper WebSocket closed.');
        this.ws = null;
      };
    });
  }

  public async startListening() {
    console.log('[SPEECH ENGINE - STT] 🔄 startListening() called');
    if (this.isRecording) {
      console.log('[SPEECH ENGINE - STT] ⚠️ Already recording.');
      return;
    }

    this.speechDetected = false;
    this.silenceStart = 0;
    this.sessionStart = Date.now();
    this.vadTriggered = false;
    this.noiseFloor = 0.001;
    this.speechCandidateMs = 0;
    this.preSpeechFrames = [];
    this.accumulatedSessionFrames = [];
    const generation = ++this.sessionGeneration;

    // Request the microphone before awaiting the local STT WebSocket. In WKWebView,
    // waiting on another async operation first can lose the user-activation window
    // required to show the macOS microphone permission prompt.
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error('Microphone capture is unavailable in this app window.');
      this.onError?.(error.message);
      throw error;
    }
    const microphone = navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    microphone.catch(() => {});

    // Connect to local Whisper at the same time as the permission request.
    // Recording startup must not wait for the STT server to become available.
    const settings = useSettingsStore.getState();
    const pref = settings.sttEnginePreference;
    let connectionReady: Promise<void> = Promise.resolve();
    if (pref !== 'gemini_live') {
      connectionReady = this.ensureConnected().then(() => {
        this.ws?.send(JSON.stringify({ type: 'reset' }));
      }).catch(e => {
        console.warn('[SPEECH ENGINE - STT] Local Whisper offline. Capturing audio for Gemini Cloud STT.');
      });
    }

    if (generation !== this.sessionGeneration) {
      microphone.then(stream => stream.getTracks().forEach(track => track.stop())).catch(() => {});
      return;
    }

    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContext = context;
      console.log('[SPEECH ENGINE - STT] 🎤 Requesting microphone access with AEC...');
      microphone.then(stream => {
        if (generation !== this.sessionGeneration) stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});
      const [stream] = await Promise.all([
        Promise.race([
          microphone,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Microphone permission timed out')), 15000)),
        ]),
        connectionReady,
      ]);
      if (generation !== this.sessionGeneration) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.mediaStream = stream;
      console.log('[SPEECH ENGINE - STT] ✅ Microphone access granted!');

      const nativeSampleRate = this.audioContext.sampleRate;
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Microphone audio context did not start')), 5000)),
      ]);
      if (generation !== this.sessionGeneration) return;

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        if (this.vadTriggered) return;
        this.lastAudioFrame = Date.now();

        const inputData = e.inputBuffer.getChannelData(0);

        // ─── Resample to 16 kHz ───
        let samples: Float32Array;
        if (nativeSampleRate === 16000) {
          samples = new Float32Array(inputData);
        } else {
          const ratio = nativeSampleRate / 16000;
          const outLen = Math.round(inputData.length / ratio);
          samples = new Float32Array(outLen);
          for (let i = 0; i < outLen; i++) {
            const src = Math.min(Math.round(i * ratio), inputData.length - 1);
            samples[i] = inputData[src];
          }
        }

        // Always save for potential Gemini cloud fallback
        this.accumulatedSessionFrames.push(samples);

        // Send to local WS if open and not forced Gemini
        if (this.ws?.readyState === WebSocket.OPEN && pref !== 'gemini_live') {
          if (!this.bufferUntilSpeech || this.speechDetected) {
            this.ws.send(samples.buffer as ArrayBuffer);
          } else {
            this.preSpeechFrames.push(samples);
            while (this.preSpeechFrames.reduce((n, frame) => n + frame.length, 0) > 8000 && this.preSpeechFrames.length > 1) {
              this.preSpeechFrames.shift();
            }
          }
        }

        // ─── Voice Activity Detection ───
        const rms = Math.sqrt(
          samples.reduce((sum, s) => sum + s * s, 0) / samples.length
        );
        const now = Date.now();
        const threshold = this.speechDetected
          ? Math.max(0.006, this.noiseFloor * 2.5)
          : Math.max(this.speechStartThreshold, this.noiseFloor * 3);
        if (rms < this.speechStartThreshold) {
          this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02;
        }
        const voiced = rms > threshold;
        if (!this.speechDetected) {
          this.speechCandidateMs = voiced ? this.speechCandidateMs + samples.length / 16 : 0;
        }

        if (voiced && (this.speechDetected || this.speechCandidateMs >= this.minimumSpeechMs)) {
          if (!this.speechDetected) {
            this.speechDetected = true;
            console.log('[SPEECH ENGINE - STT] 🗣️ User began speaking');
            if (this.ws?.readyState === WebSocket.OPEN && this.preSpeechFrames.length > 0) {
              for (const pre of this.preSpeechFrames) {
                this.ws.send(pre.buffer as ArrayBuffer);
              }
              this.preSpeechFrames = [];
            }
            this.onSpeechStarted?.();
          }
          this.silenceStart = 0;
        } else if (this.speechDetected) {
          if (this.silenceStart === 0) this.silenceStart = now;
          if (now - this.silenceStart >= SILENCE_AFTER_SPEECH_MS) {
            console.log('[SPEECH ENGINE - STT] 🤫 Speech finished, processing');
            this.triggerVADEnd();
          }
        } else {
          if (now - this.sessionStart >= this.idleTimeoutMs) {
            console.log('[SPEECH ENGINE - STT] ⏳ Idle timeout, aborting');
            this.vadTriggered = true;
            this.stopListening();
            this.ws?.send(JSON.stringify({ type: 'reset' }));
            this.onIdleTimeout?.();
          }
        }
      };

      this.sessionStart = Date.now();
      this.lastAudioFrame = this.sessionStart;
      this.isRecording = true;
      this.captureWatchdog = setInterval(() => {
        if (!this.isRecording || this.vadTriggered) return;
        const now = Date.now();
        if (now - this.lastAudioFrame > 5000) {
          this.stopListening();
          this.onError?.('Microphone audio stopped. Check microphone permission and try again.');
        } else if (!this.speechDetected && now - this.sessionStart >= this.idleTimeoutMs) {
          this.vadTriggered = true;
          this.stopListening();
          this.ws?.send(JSON.stringify({ type: 'reset' }));
          this.onIdleTimeout?.();
        } else if (this.speechDetected && (now - this.sessionStart >= 60000 || (this.silenceStart > 0 && now - this.silenceStart >= SILENCE_AFTER_SPEECH_MS))) {
          this.triggerVADEnd();
        }
      }, 250);
      console.log('[SPEECH ENGINE - STT] 🎙️ Streaming audio + running VAD');
    } catch (err) {
      if (generation !== this.sessionGeneration) return;
      this.stopListening();
      console.error('[SPEECH ENGINE - STT] ❌ Error accessing microphone:', err);
      if (this.onError) this.onError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  }

  private triggerVADEnd() {
    if (this.vadTriggered) return;
    this.vadTriggered = true;
    this.stopListening();
    this.processAudio();
    if (this.onSpeechEnded) this.onSpeechEnded();
  }

  public stopListening() {
    ++this.sessionGeneration;
    this.isRecording = false;
    if (this.captureWatchdog) clearInterval(this.captureWatchdog);
    this.captureWatchdog = null;

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('[SPEECH ENGINE - STT] 🛑 Stopped listening');
  }

  public processAudio() {
    const settings = useSettingsStore.getState();
    const pref = settings.sttEnginePreference;

    if (pref === 'whisper' && this.ws?.readyState === WebSocket.OPEN) {
      console.log('[SPEECH ENGINE - STT] ⚙️ Processing via local Whisper.cpp');
      this.ws.send(JSON.stringify({ type: 'process' }));
    } else if (pref === 'gemini_live') {
      console.log('[SPEECH ENGINE - STT] ⚙️ Processing via Gemini Live STT API (User Preferred)');
      this.transcribeWithGeminiFallback();
    } else {
      // Auto: Try Whisper if connected, else Gemini
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('[SPEECH ENGINE - STT] ⚙️ Processing via local Whisper.cpp');
        this.ws.send(JSON.stringify({ type: 'process' }));
      } else {
        console.log('[SPEECH ENGINE - STT] ⚙️ Whisper offline. Processing via Gemini Live STT API (Cloud Fallback)');
        this.transcribeWithGeminiFallback();
      }
    }
  }

  private async transcribeWithGeminiFallback() {
    if (this.accumulatedSessionFrames.length === 0) {
      console.warn('[SPEECH ENGINE - STT] No audio captured to transcribe.');
      if (this.onTranscription) this.onTranscription('[BLANK_AUDIO]');
      return;
    }

    try {
      const settings = useSettingsStore.getState();
      const keys = settings.geminiApiKeys;
      const key = keys.length > 0 ? keys[settings.activeKeyIndex] || keys[0] : (import.meta.env.VITE_GEMINI_API_KEYS || '').split(',')[0]?.trim();
      if (!key) {
        throw new Error('Gemini API key is not configured for cloud STT fallback.');
      }

      console.log('[SPEECH ENGINE - STT] ☁️ Converting audio and sending to Gemini Flash...');
      const wavBlob = float32ToWavBlob(this.accumulatedSessionFrames);
      const base64Audio = await blobToBase64(wavBlob);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: base64Audio
                }
              },
              {
                text: 'Transcribe this user speech accurately in Hindi, English, or Hinglish. Output ONLY the plain transcription text with no explanations, no quotes, and no sound tags.'
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 250
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini STT returned HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      console.log(`[SPEECH ENGINE - STT] 📝 Gemini Live STT Result: "${text}"`);

      if (text) {
        if (this.onTranscription) this.onTranscription(text);
      } else {
        if (this.onTranscription) this.onTranscription('[BLANK_AUDIO]');
      }
    } catch (e: any) {
      console.error('[SPEECH ENGINE - STT] ❌ Gemini STT fallback error:', e);
      if (this.onError) this.onError(e.message || String(e));
    }
  }
}
