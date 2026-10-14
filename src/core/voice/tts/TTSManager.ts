import { useTTSPlaybackStore } from './playbackStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useSettingsStore } from '../../../stores/settingsStore';

export class TTSManager {
  public onSpeechStarted: (() => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;
  
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private resumeInterval: ReturnType<typeof setTimeout> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private resolveLocalSpeech: (() => void) | null = null;
  private playbackTokens = new Set<string>();
  private pausedForInterruption = false;
  private resumeWaiters: Array<() => void> = [];

  public pause(): void {
    this.pausedForInterruption = true;
    this.currentAudio?.pause();
    this.synth.pause();
  }

  public resume(): void {
    this.pausedForInterruption = false;
    this.resumeWaiters.splice(0).forEach(resolve => resolve());
    if (this.currentAudio) void this.currentAudio.play().catch(() => this.stop());
    this.synth.resume();
  }

  private waitUntilResumed(): Promise<void> {
    return this.pausedForInterruption ? new Promise(resolve => this.resumeWaiters.push(resolve)) : Promise.resolve();
  }

  private beginPlayback(token: string) {
    this.playbackTokens.add(token);
    useTTSPlaybackStore.getState().started(token);
  }

  private endPlayback(token: string) {
    this.playbackTokens.delete(token);
    useTTSPlaybackStore.getState().ended(token);
  }

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
    this.pausedForInterruption = false;
    this.resumeWaiters.splice(0).forEach(resolve => resolve());
    this.wasInterrupted = true;
    for (const token of this.playbackTokens) this.endPlayback(token);
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
          voice: 'auto',
          speed: 1.0
        }),
        // Allow enough time for neural synthesis without premature timeout
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[TTSManager] Kokoro responded with HTTP ${response.status}: ${errText}`);
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("[TTSManager] Error fetching Kokoro chunk:", e);
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
         await this.waitUntilResumed();
         
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
                 
                 const playbackToken = crypto.randomUUID();
                 const audio = new Audio(audioUrl);
                 this.currentAudio = audio;
                 
                 const cleanup = () => {
                     this.endPlayback(playbackToken);
                     URL.revokeObjectURL(audioUrl);
                     if (this.currentAudio === audio) {
                       this.currentAudio = null;
                     }
                     res();
                 };
                 
                 audio.onplay = () => {
                     if (this.currentAudio !== audio || this.wasInterrupted) return;
                     this.beginPlayback(playbackToken);
                     if (i === 0 && this.onSpeechStarted) this.onSpeechStarted();
                 };
                 
                 audio.onended = cleanup;
                 audio.onerror = cleanup;
                 
                 audio.play().catch(cleanup);
             });
         } else {
             console.warn("[TTSManager] Kokoro chunk failed to generate.");
             throw new Error("Kokoro chunk generation failed on port 48126");
         }
      }

      this.currentAudio = null;
      const wasNatural = this._isKokoroSpeaking; // true = ended naturally
      this._isKokoroSpeaking = false;

      if (wasNatural && this.onSpeechEnded) {
          this.onSpeechEnded();
      }
    } catch (err: any) {
      this._isKokoroSpeaking = false;
      if (this.wasInterrupted) return;
      console.error("[TTSManager] Kokoro speech failed:", err);
      throw err;
    }
  }

  public async sarvamSpeak(text: string): Promise<void> {
    this.wasInterrupted = false;
    const settings = useSettingsStore.getState();
    const apiKey = settings.sarvamApiKey || (import.meta.env.VITE_SARVAM_API_KEY as string) || '';
    if (!apiKey) throw new Error('SARVAM_API_KEY is not configured in settings or .env');

    const speaker = settings.sarvamSpeaker || 'aarti_hi_customer';
    const langCode = settings.sarvamLanguageCode || 'hi-IN';

    // Clean text for speech
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .replace(/_/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/>/g, '')
      .replace(/---/g, '')
      .trim();

    if (!cleanText) return;

    useVoiceStore.getState().setActiveVoiceEngine('Sarvam AI (Aarti hi-IN)');
    useVoiceStore.getState().setActiveVoiceName(speaker);

    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        language_code: langCode,
        speaker: speaker,
        model: 'bulbul:v4-flash',
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Sarvam AI API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.audios || data.audios.length === 0) {
      throw new Error('Sarvam AI returned empty audio response');
    }

    const audioUrl = `data:audio/wav;base64,${data.audios[0]}`;
    await this.playAudioUrl(audioUrl);
  }

  public async playAudioUrl(url: string): Promise<void> {
    this.wasInterrupted = false;
    return new Promise(async (resolve, reject) => {
      try {
        const playbackToken = crypto.randomUUID();
        const audio = new Audio(url);
        this.currentAudio = audio;

        audio.onplay = () => {
          if (this.currentAudio !== audio || this.wasInterrupted) return;
          this.beginPlayback(playbackToken);
          if (this.onSpeechStarted) this.onSpeechStarted();
        };

        audio.onended = () => {
          this.endPlayback(playbackToken);
          if (this.currentAudio === audio) this.currentAudio = null;
          if (this.onSpeechEnded) this.onSpeechEnded();
          resolve();
        };

        audio.onerror = (e) => {
          this.endPlayback(playbackToken);
          console.error('[TTSManager] Audio playback error:', e);
          if (this.currentAudio === audio) this.currentAudio = null;
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

  public async speak(text: string): Promise<void> {
    this.stop(); // Stop any ongoing speech and clear intervals
    this.wasInterrupted = false;

    const settings = useSettingsStore.getState();
    const preference = settings.ttsEnginePreference;

    const kokoroFn = () => this.kokoroSpeak(text);
    const sarvamFn = () => this.sarvamSpeak(text);
    const elevenLabsFn = () => {
      const apiKey = settings.elevenLabsApiKey || import.meta.env.VITE_ELEVENLABS_API_KEY;
      const voiceId = settings.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
      if (!apiKey) throw new Error('ElevenLabs API key not configured');
      useVoiceStore.getState().setActiveVoiceEngine('ElevenLabs (Cloud)');
      useVoiceStore.getState().setActiveVoiceName(voiceId);
      return this.elevenLabsSpeak(text, apiKey, voiceId);
    };
    const nativeFn = () => this.localSpeak(text);

    // Build execution order based on selection
    const enginesToTry: Array<{ name: string; fn: () => Promise<void> }> = [];

    if (preference === 'kokoro') {
      enginesToTry.push({ name: 'Kokoro Neural (Local)', fn: kokoroFn });
      enginesToTry.push({ name: 'Sarvam AI (Fallback)', fn: sarvamFn });
      enginesToTry.push({ name: 'ElevenLabs (Fallback)', fn: elevenLabsFn });
      enginesToTry.push({ name: 'macOS Native (Fallback)', fn: nativeFn });
    } else if (preference === 'sarvam') {
      enginesToTry.push({ name: 'Sarvam AI (Aarti)', fn: sarvamFn });
      enginesToTry.push({ name: 'Kokoro Neural (Fallback)', fn: kokoroFn });
      enginesToTry.push({ name: 'ElevenLabs (Fallback)', fn: elevenLabsFn });
      enginesToTry.push({ name: 'macOS Native (Fallback)', fn: nativeFn });
    } else if (preference === 'elevenlabs') {
      enginesToTry.push({ name: 'ElevenLabs', fn: elevenLabsFn });
      enginesToTry.push({ name: 'Sarvam AI (Fallback)', fn: sarvamFn });
      enginesToTry.push({ name: 'Kokoro Neural (Fallback)', fn: kokoroFn });
      enginesToTry.push({ name: 'macOS Native (Fallback)', fn: nativeFn });
    } else if (preference === 'native') {
      enginesToTry.push({ name: 'macOS Native Speech', fn: nativeFn });
    } else {
      // 'auto': Kokoro -> Sarvam AI -> ElevenLabs -> macOS Native
      enginesToTry.push({ name: 'Kokoro Neural (Local)', fn: kokoroFn });
      enginesToTry.push({ name: 'Sarvam AI (Aarti Cloud)', fn: sarvamFn });
      enginesToTry.push({ name: 'ElevenLabs (Cloud)', fn: elevenLabsFn });
      enginesToTry.push({ name: 'macOS Native Speech', fn: nativeFn });
    }

    for (let i = 0; i < enginesToTry.length; i++) {
      if (this.wasInterrupted) return;
      const engine = enginesToTry[i];
      try {
        await engine.fn();
        if (i === 0) {
          useVoiceStore.getState().setLastTTSError(null);
        } else {
          console.log(`[TTSManager] ✅ Active fallback engaged: ${engine.name}`);
        }
        return;
      } catch (err: any) {
        if (this.wasInterrupted) return;
        const msg = err.message || String(err);
        console.warn(`[TTSManager] ⚠️ ${engine.name} failed (${msg}). Trying next fallback...`);
        useVoiceStore.getState().setLastTTSError(`${engine.name} failed: ${msg}`);
      }
    }

    if (!this.wasInterrupted) {
      console.warn('[TTSManager] All engines failed. Using macOS Native fallback.');
      await this.localSpeak(text);
    }
  }

  private async elevenLabsSpeak(text: string, apiKey: string, voiceId: string): Promise<void> {
    this.wasInterrupted = false;
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
    if (this.wasInterrupted) return;
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    try {
      await this.playAudioUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private async localSpeak(text: string): Promise<void> {
    this.wasInterrupted = false;
    const playbackToken = crypto.randomUUID();
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

      const utterance = this.currentUtterance;
      this.currentUtterance.onstart = () => {
        if (this.currentUtterance !== utterance || this.wasInterrupted) return;
        this.beginPlayback(playbackToken);
        if (this.onSpeechStarted) this.onSpeechStarted();
        
        // Chromium bug workaround: pause/resume every 14 seconds so long texts don't hang
        this.resumeInterval = setInterval(() => {
          if (this.synth.speaking) {
            if (!this.pausedForInterruption) {
              this.synth.pause();
              this.synth.resume();
            }
          }
        }, 14000);
      };

      this.currentUtterance.onend = () => {
        this.endPlayback(playbackToken);
        if (this.currentUtterance === utterance) {
          this.cleanupLocal();
          if (!this.wasInterrupted && this.onSpeechEnded) this.onSpeechEnded();
        }
        resolve();
      };

      this.currentUtterance.onerror = (e) => {
        this.endPlayback(playbackToken);
        console.error('[TTSManager] Speech error:', e);
        if (this.currentUtterance === utterance) {
          this.cleanupLocal();
          if (!this.wasInterrupted && this.onSpeechEnded) this.onSpeechEnded();
        }
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
