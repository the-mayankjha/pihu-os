import { useVoiceStore } from '../../../stores/voiceStore';

export class TTSManager {
  public onSpeechStarted: (() => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;
  
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private resumeInterval: ReturnType<typeof setTimeout> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isKokoroSpeaking: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = this.initVoice.bind(this);
    }
    this.initVoice();
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
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    this.isKokoroSpeaking = false;
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
        })
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
    this.isKokoroSpeaking = true;
    return new Promise(async (resolve) => {
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
        // If a chunk is just 2 words, it plays instantly, causing a pause while the next chunk generates.
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
            resolve();
            return;
        }

        let nextFetchPromise = this.fetchKokoroChunk(sentences[0]);

        for (let i = 0; i < sentences.length; i++) {
           if (!this.isKokoroSpeaking) break; // Stop if interrupted
           
           const audioUrl = await nextFetchPromise;
           
           // Prefetch the next chunk while this one is about to play
           if (i + 1 < sentences.length) {
               nextFetchPromise = this.fetchKokoroChunk(sentences[i + 1]);
           }

           if (audioUrl) {
               await new Promise((res) => {
                   this.currentAudio = new Audio(audioUrl);
                   
                   this.currentAudio.onplay = () => {
                       if (i === 0 && this.onSpeechStarted) this.onSpeechStarted();
                   };
                   
                   this.currentAudio.onended = () => {
                       URL.revokeObjectURL(audioUrl);
                       res(null);
                   };
                   
                   this.currentAudio.onerror = (e) => {
                       console.error('[TTSManager] Chunk playback error:', e);
                       URL.revokeObjectURL(audioUrl);
                       res(null);
                   };
                   
                   this.currentAudio.play().catch(res);
               });
           } else {
               // If fetch failed, fallback to native for the rest
               console.warn("[TTSManager] Kokoro chunk failed, falling back to native TTS");
               await this.localSpeak(sentences.slice(i).join(" "));
               break;
           }
        }

        this.currentAudio = null;
        if (this.onSpeechEnded && this.isKokoroSpeaking) {
            this.onSpeechEnded();
        }
        this.isKokoroSpeaking = false;
        resolve();
      } catch (err: any) {
        console.error("[TTSManager] Kokoro speech failed:", err);
        await this.localSpeak(text);
        resolve();
      }
    });
  }

  public async speak(text: string): Promise<void> {
    this.stop(); // Stop any ongoing speech and clear intervals

    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    if (navigator.onLine && apiKey) {
      try {
        useVoiceStore.getState().setActiveVoiceEngine('ElevenLabs (Online)');
        useVoiceStore.getState().setActiveVoiceName(voiceId);
        useVoiceStore.getState().setLastTTSError(null);
        return await this.elevenLabsSpeak(text, apiKey, voiceId);
      } catch (error: any) {
        console.error('[TTSManager] ElevenLabs failed, falling back to local TTS:', error);
        useVoiceStore.getState().setLastTTSError(error.message || String(error));
        return this.kokoroSpeak(text);
      }
    } else {
      if (!navigator.onLine) {
        useVoiceStore.getState().setLastTTSError("No internet connection.");
      } else if (!apiKey) {
        useVoiceStore.getState().setLastTTSError("ElevenLabs API key is missing in environment variables (.env).");
      }
      return this.kokoroSpeak(text);
    }
  }

  private async elevenLabsSpeak(text: string, apiKey: string, voiceId: string): Promise<void> {
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
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        this.currentAudio = new Audio(url);
        
        this.currentAudio.onplay = () => {
          if (this.onSpeechStarted) this.onSpeechStarted();
        };

        this.currentAudio.onended = () => {
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          if (this.onSpeechEnded) this.onSpeechEnded();
          resolve();
        };

        this.currentAudio.onerror = (e) => {
          console.error('[TTSManager] Audio playback error:', e);
          URL.revokeObjectURL(url);
          this.currentAudio = null;
          reject(new Error('Audio playback failed'));
        };

        await this.currentAudio.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async localSpeak(text: string): Promise<void> {
    return new Promise((resolve) => {
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
        if (this.onSpeechEnded) this.onSpeechEnded();
        resolve(); // Resolve anyway so we don't block
      };

      this.synth.speak(this.currentUtterance);
    });
  }

  private cleanupLocal() {
    this.currentUtterance = null;
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }

  public stop() {
    this.cleanupLocal();
    
    // Stop local TTS
    if (this.synth.speaking) {
      this.synth.cancel();
      if (this.onSpeechEnded) this.onSpeechEnded();
    }

    // Stop ElevenLabs Audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Note: onended event doesn't fire when pause() is called
      this.currentAudio = null;
      if (this.onSpeechEnded) this.onSpeechEnded();
    }
    
    // Stop Kokoro Audio
    if (this.kokoroSource) {
      this.kokoroSource.stop();
      this.kokoroSource.disconnect();
      this.kokoroSource = null;
    }
  }
}
