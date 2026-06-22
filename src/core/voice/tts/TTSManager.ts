export class TTSManager {
  public onSpeechStarted: (() => void) | null = null;
  public onSpeechEnded: (() => void) | null = null;
  
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;

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

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private resumeInterval: NodeJS.Timeout | null = null;

  public async speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.stop(); // Stop any ongoing speech and clear intervals

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
        this.cleanup();
        if (this.onSpeechEnded) this.onSpeechEnded();
        resolve();
      };

      this.currentUtterance.onerror = (e) => {
        console.error('[TTSManager] Speech error:', e);
        this.cleanup();
        if (this.onSpeechEnded) this.onSpeechEnded();
        resolve(); // Resolve anyway so we don't block
      };

      this.synth.speak(this.currentUtterance);
    });
  }

  private cleanup() {
    this.currentUtterance = null;
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
  }

  public stop() {
    this.cleanup();
    if (this.synth.speaking) {
      this.synth.cancel();
      if (this.onSpeechEnded) this.onSpeechEnded();
    }
  }
}
