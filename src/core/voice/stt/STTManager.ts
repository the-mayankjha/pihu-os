// VAD thresholds (tuned for typical speech at 16kHz or native rate)
const SPEECH_RMS_THRESHOLD = 0.015;          // RMS above this = speaking
const SILENCE_AFTER_SPEECH_MS  = 1500;       // 1.5s of quiet after speech → end session
const DEFAULT_IDLE_TIMEOUT_MS  = 6000;       // 6s with no speech at all → end session

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

  // Browser-side VAD state
  private speechDetected: boolean = false;
  private silenceStart: number = 0;       // timestamp when silence began
  private sessionStart: number = 0;       // timestamp when recording began
  private vadTriggered: boolean = false;  // guard: only fire once per session

  /** Configurable idle timeout per session (default 6s, set longer for follow-up). */
  public idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS;

  public onTranscription: ((text: string) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;  // fired when browser VAD detects end-of-speech
  public onIdleTimeout: (() => void) | null = null;
  public onSpeechStarted: (() => void) | null = null; // fired as soon as user starts speaking

  constructor() {
    // Pre-connect so there is zero latency when the wake word fires
    this.ensureConnected().catch(e =>
      console.warn('[SPEECH ENGINE - STT] Pre-connect failed, will retry on demand:', e)
    );
  }

  /** Idempotent: returns immediately if already open or already connecting. */
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
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.log('[SPEECH ENGINE - STT] 🟢 Connected to STT WebSocket server');
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
            if (this.onError) this.onError(data.message);
          }
        } catch (e) {
          console.error('[SPEECH ENGINE - STT] ❌ Error parsing message:', e, event.data);
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.error('[SPEECH ENGINE - STT] ❌ WebSocket error:', error);
        if (this.onError) this.onError('WebSocket connection error');
        reject(error);
      };

      this.ws.onclose = () => {
        clearTimeout(connectionTimeout);
        reject(new Error('STT connection closed'));
        this.isConnecting = false;
        console.log('[SPEECH ENGINE - STT] 🔴 WebSocket closed. Will reconnect on next session.');
        // If we were recording when the socket dropped, notify VoiceManager
        // so isProcessing doesn't get stuck permanently.
        if (this.isRecording) {
          console.error('[SPEECH ENGINE - STT] ❌ WebSocket closed while recording! Firing error.');
          this.stopListening();
          if (this.onError) this.onError('WebSocket closed unexpectedly during recording');
        }
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

    // Reset browser-side VAD state
    this.speechDetected = false;
    this.silenceStart = 0;
    this.sessionStart = Date.now();
    this.vadTriggered = false;
    const generation = ++this.sessionGeneration;

    // Ensure WebSocket is live before opening mic
    await this.ensureConnected();
    this.ws?.send(JSON.stringify({ type: 'reset' }));

    try {
      // WKWebView can create a suspended context when a wake-word event starts
      // capture outside a click handler. Resume it explicitly before streaming.
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContext = context;
      console.log('[SPEECH ENGINE - STT] 🎤 Requesting microphone access with AEC...');
      const microphone = navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      // Permission requests may remain pending; late grants must not leak a mic.
      microphone.then(stream => {
        if (generation !== this.sessionGeneration) stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});
      const stream = await Promise.race([
        microphone,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Microphone permission timed out')), 15000)),
      ]);
      if (generation !== this.sessionGeneration) return;
      this.mediaStream = stream;
      console.log('[SPEECH ENGINE - STT] ✅ Microphone access granted (AEC active)!');

      // Don't force 16kHz — most devices can't honour it and produce garbage.
      // We resample in the processing callback instead.
      const nativeSampleRate = this.audioContext.sampleRate;

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      // Requesting the mic first also unlocks audio in WebKit configurations
      // that require active capture before a non-gesture resume can succeed.
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Microphone audio context did not start')), 5000)),
      ]);
      if (generation !== this.sessionGeneration) return;

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording || this.ws?.readyState !== WebSocket.OPEN) return;
        if (this.vadTriggered) return; // session already ending
        this.lastAudioFrame = Date.now();

        const inputData = e.inputBuffer.getChannelData(0);

        // ─── Resample to 16 kHz (copy-safe) ────────────────────────────────
        let samples: Float32Array;
        if (nativeSampleRate === 16000) {
          samples = new Float32Array(inputData); // ✅ copy shared buffer
        } else {
          const ratio = nativeSampleRate / 16000;
          const outLen = Math.round(inputData.length / ratio);
          samples = new Float32Array(outLen);
          for (let i = 0; i < outLen; i++) {
            const src = Math.min(Math.round(i * ratio), inputData.length - 1);
            samples[i] = inputData[src];
          }
        }
        this.ws!.send(samples.buffer as ArrayBuffer);

        // ─── Browser-side Voice Activity Detection ─────────────────────────
        const rms = Math.sqrt(
          samples.reduce((sum, s) => sum + s * s, 0) / samples.length
        );
        const now = Date.now();

        if (rms > SPEECH_RMS_THRESHOLD) {
          // User is speaking
          if (!this.speechDetected) {
            console.log('[SPEECH ENGINE - STT] 🗣️ Speech detected (RMS:', rms.toFixed(4), ')');
            if (this.onSpeechStarted) this.onSpeechStarted();
          }
          this.speechDetected = true;
          this.silenceStart = 0; // reset silence clock
        } else {
          if (this.speechDetected) {
            // We had speech, now silence — start the silence timer
            if (this.silenceStart === 0) this.silenceStart = now;

            const silenceDuration = now - this.silenceStart;
            if (silenceDuration >= SILENCE_AFTER_SPEECH_MS) {
              console.log(`[SPEECH ENGINE - STT] 🤫 ${SILENCE_AFTER_SPEECH_MS}ms silence after speech → ending session`);
              this.triggerVADEnd();
            }
          } else {
            // No speech yet — check idle timeout
            const idleDuration = now - this.sessionStart;
            if (idleDuration >= this.idleTimeoutMs) {
              console.log('[SPEECH ENGINE - STT] ⏳ Idle timeout — no speech detected, aborting session');
              this.vadTriggered = true;
              this.stopListening();
              this.ws?.send(JSON.stringify({ type: 'reset' }));
              this.onIdleTimeout?.();
            }
          }
        }
      };

      this.sessionStart = Date.now();
      this.lastAudioFrame = this.sessionStart;
      this.isRecording = true;
      // Use wall time, independently of ScriptProcessor callbacks. A stopped
      // WebKit capture graph must never leave the voice UI stuck listening.
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
      console.log('[SPEECH ENGINE - STT] 🎙️ Streaming audio + running browser VAD');
    } catch (err) {
      if (generation !== this.sessionGeneration) return;
      this.stopListening();
      console.error('[SPEECH ENGINE - STT] ❌ Error accessing microphone:', err);
      if (this.onError) this.onError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  }

  /** Called by browser VAD — fires onSpeechEnded so VoiceManager can process. */
  private triggerVADEnd() {
    if (this.vadTriggered) return;
    this.vadTriggered = true;

    // Stop capturing immediately to avoid extra audio being sent
    this.stopListening();

    // Tell server to process what it received
    this.processAudio();

    // Notify VoiceManager
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[SPEECH ENGINE - STT] ⚙️ Requesting server to process accumulated audio');
      this.ws.send(JSON.stringify({ type: 'process' }));
    } else {
      console.error('[SPEECH ENGINE - STT] ❌ Cannot process: WebSocket not open');
    }
  }
}
