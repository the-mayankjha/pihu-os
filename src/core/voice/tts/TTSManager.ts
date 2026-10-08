import { useVoiceStore } from '../../../stores/voiceStore';

export class TTSManager {
  public onSpeechStarted: (() => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;
  
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private resumeInterval: ReturnType<typeof setTimeout> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private resolveLocalSpeech: (() => void) | null = null;
  private _isKokoroSpeaking: boolean = false;

  /** True if stop() was called (barge-in interrupt), false if speech ended naturally. */
  public wasInterrupted: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = this.initVoice.bind(this);
    }
    this.initVoice();
  }

  /** Returns true if any TTS engine is currently producing audio. */
  public get isSpeaking(): boolean {
    return this._isKokoroSpeaking || this.synth.speaking || this.currentAudio !== null;
  }

  private initVoice() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    // Try to find a good female voice (like Veena on Mac, or any good English female voice)
    const preferredVoices = [
      'Veena', // Good Indian English female voice on macOS
      'Google UK English Female',
      'Samantha',
      'Victoria',
      'Karen'
    ];

    for (const pref of preferredVoices) {
      const found = voices.find(v => v.name.includes(pref));
      if (found) {
        this.voice = found;
        return;
      }
    }

    // Fallback to first English female or just first English voice
    this.voice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) 
              || voices.find(v => v.lang.startsWith('en')) 
              || voices[0];
  }

  public stop(): void {
    this.wasInterrupted = true;
    this.resolveLocalSpeech?.();
    this.resolveLocalSpeech = null;

    if (this.synth.speaking) {
      this.synth.cancel();
    }
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
    if (this.currentAudio) {
      // Trigger onerror/onended so pending promises resolve instead of hanging.
      // Setting src to '' after pause fires the error event on most browsers.
      const audio = this.currentAudio;
      this.currentAudio = null;
      audio.pause();
      audio.src = '';
      audio.load(); // Forces error event to fire, resolving the promise
    }
    this._isKokoroSpeaking = false;
    this.currentUtterance = null;
  }

  private async fetchKokoroChunk(text: string): Promise<string | null> {
    try {
      const response = await fetch('http://127.0.0.1:48126/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'af_bella',
          speed: 1.0
        }),
        // Prevent infinite hang if Kokoro server stalls
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) return null;
      
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("[TTSManager] Error fetching chunk:", e);
      return null;
    }
  }

  private async kokoroSpeak(text: string): Promise<void> {
    this._isKokoroSpeaking = true;
    this.wasInterrupted = false;

    try {
      useVoiceStore.getState().setActiveVoiceEngine('Kokoro TTS (Local AI)');
      useVoiceStore.getState().setActiveVoiceName('af_bella');
      
      // Clean markdown characters so Kokoro doesn't read asterisks
      const cleanText = text
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/#/g, '')
          .replace(/_/g, '')
          .replace(/`/g, '')
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Keep link text, remove URL
          .replace(/>/g, '')
          .replace(/---/g, '');

      // Split text into raw sentences
      const rawSentences = cleanText.replace(/([.!?\n])\s+/g, "$1|").split("|").map(s => s.trim()).filter(s => s.length > 0);
      
      // Group sentences to ensure each chunk is long enough to cover generation time of the NEXT chunk
      const minChunkLength = 50;
      const sentences: string[] = [];
      let currentChunk = "";
      
      for (const s of rawSentences) {
          currentChunk += (currentChunk ? " " : "") + s;
          if (currentChunk.length >= minChunkLength) {
              sentences.push(currentChunk);
              currentChunk = "";
          }
      }
      if (currentChunk.length > 0) {
          sentences.push(currentChunk);
      }
      
      if (sentences.length === 0) {
          this._isKokoroSpeaking = false;
          return;
      }

      let nextFetchPromise = this.fetchKokoroChunk(sentences[0]);

      for (let i = 0; i < sentences.length; i++) {
         if (!this._isKokoroSpeaking) break; // Stop if interrupted
         
         const audioUrl = await nextFetchPromise;
         
         if (!this._isKokoroSpeaking) {
           // Interrupted while fetching — clean up and exit
           if (audioUrl) URL.revokeObjectURL(audioUrl);
           break;
         }

         // Prefetch the next chunk while this one is about to play
         if (i + 1 < sentences.length) {
             nextFetchPromise = this.fetchKokoroChunk(sentences[i + 1]);
         }

         if (audioUrl) {
             await new Promise<void>((res) => {
                 if (!this._isKokoroSpeaking) {
                   URL.revokeObjectURL(audioUrl);
                   res();
                   return;
                 }
                 
                 const audio = new Audio(audioUrl);
                 this.currentAudio = audio;
                 
                 const cleanup = () => {
                     URL.revokeObjectURL(audioUrl);
                     if (this.currentAudio === audio) {
                       this.currentAudio = null;
                     }
                     res();
                 };
                 
                 audio.onplay = () => {
                     if (i === 0 && this.onSpeechStarted) this.onSpeechStarted();
                 };
                 
                 audio.onended = cleanup;
                 audio.onerror = cleanup;
                 
                 audio.play().catch(cleanup);
             });
         } else {
             // If fetch failed, fallback to native for the rest
             console.warn("[TTSManager] Kokoro chunk failed, falling back to native TTS");
             await this.localSpeak(sentences.slice(i).join(" "));
             break;
         }
      }

      this.currentAudio = null;
      const wasNatural = this._isKokoroSpeaking; // true = ended naturally
      this._isKokoroSpeaking = false;

      if (wasNatural && this.onSpeechEnded) {
          this.onSpeechEnded();
      }
    } catch (err: any) {
      if (this.wasInterrupted) return;
      console.error("[TTSManager] Kokoro speech failed:", err);
      this._isKokoroSpeaking = false;
      try {
        await this.localSpeak(text);
      } catch (e2) {
        console.error("[TTSManager] Local fallback also failed:", e2);
      }
    }
  }

  public async speak(text: string): Promise<void> {
    this.stop(); // Stop any ongoing speech and clear intervals
    this.wasInterrupted = false; // Reset for this new speech

    // We prioritize Kokoro TTS (Local AI) as the default engine.
    try {
      await this.kokoroSpeak(text);
    } catch (e) {
      if (this.wasInterrupted) return;
      console.warn('[TTSManager] Kokoro failed, falling back to ElevenLabs/Native', e);
      
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

      if (navigator.onLine && apiKey) {
        try {
          useVoiceStore.getState().setActiveVoiceEngine('ElevenLabs (Online)');
          useVoiceStore.getState().setActiveVoiceName(voiceId);
          useVoiceStore.getState().setLastTTSError(null);
          await this.elevenLabsSpeak(text, apiKey, voiceId);
        } catch (error: any) {
          if (this.wasInterrupted) return;
          console.error('[TTSManager] ElevenLabs failed, falling back to local TTS:', error);
          useVoiceStore.getState().setLastTTSError(error.message || String(error));
          await this.localSpeak(text);
        }
      } else {
        await this.localSpeak(text);
      }
    }
  }

  private async elevenLabsSpeak(text: string, apiKey: string, voiceId: string): Promise<void> {
    this.wasInterrupted = false;
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
            'accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (this.wasInterrupted) { resolve(); return; }
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        this.currentAudio = audio;
        
        audio.onplay = () => {
          if (this.onSpeechStarted) this.onSpeechStarted();
        };

        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          if (this.onSpeechEnded) this.onSpeechEnded();
          resolve();
        };

        audio.onerror = (e) => {
          console.error('[TTSManager] Audio playback error:', e);
          URL.revokeObjectURL(url);
          if (this.currentAudio === audio) this.currentAudio = null;
          // If interrupted, resolve instead of reject to avoid error propagation
          if (this.wasInterrupted) {
            resolve();
          } else {
            reject(new Error('Audio playback failed'));
          }
        };

        await audio.play();
      } catch (error) {
        if (this.wasInterrupted) {
          resolve();
        } else {
          reject(error);
        }
      }
    });
  }

  private async localSpeak(text: string): Promise<void> {
    this.wasInterrupted = false;
    return new Promise((resolve) => {
      this.resolveLocalSpeech = resolve;
      useVoiceStore.getState().setActiveVoiceEngine('Local SpeechSynthesis');
      useVoiceStore.getState().setActiveVoiceName(this.voice ? this.voice.name : 'Unknown Native Voice');

      // Store in class property to prevent garbage collection before onend fires
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        this.currentUtterance.voice = this.voice;
      }
      
      this.currentUtterance.rate = 1.0;
      this.currentUtterance.pitch = 1.1; // Slightly higher pitch for Pihu
      this.currentUtterance.volume = 1.0;

      this.currentUtterance.onstart = () => {
        if (this.onSpeechStarted) this.onSpeechStarted();
        
        // Chromium bug workaround: pause/resume every 14 seconds so long texts don't hang
        this.resumeInterval = setInterval(() => {
          if (this.synth.speaking) {
            this.synth.pause();
            this.synth.resume();
          }
        }, 14000);
      };

      this.currentUtterance.onend = () => {
        this.cleanupLocal();
        if (this.onSpeechEnded) this.onSpeechEnded();
        resolve();
      };

      this.currentUtterance.onerror = (e) => {
        console.error('[TTSManager] Speech error:', e);
        this.cleanupLocal();
        if (!this.wasInterrupted && this.onSpeechEnded) this.onSpeechEnded();
        resolve(); // Resolve anyway so we don't block
      };

      this.synth.speak(this.currentUtterance);
    });
  }

  private cleanupLocal() {
    this.resolveLocalSpeech = null;
    this.currentUtterance = null;
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }

}
