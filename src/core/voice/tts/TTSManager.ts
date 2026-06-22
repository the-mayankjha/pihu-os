import { useVoiceStore } from '../../../stores/voiceStore';

export class TTSManager {
  public onSpeechStarted: (() => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;
  
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private resumeInterval: ReturnType<typeof setTimeout> | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    // Voices might be loaded asynchronously in some browsers
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

  public async speak(text: string): Promise<void> {
    this.stop(); // Stop any ongoing speech and clear intervals

    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    if (navigator.onLine && apiKey) {
      try {
        useVoiceStore.getState().setActiveVoiceEngine('ElevenLabs (Online)');
        return await this.elevenLabsSpeak(text, apiKey, voiceId);
      } catch (error) {
        console.error('[TTSManager] ElevenLabs failed, falling back to local TTS:', error);
        return this.localSpeak(text);
      }
    } else {
      return this.localSpeak(text);
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
  }
}
