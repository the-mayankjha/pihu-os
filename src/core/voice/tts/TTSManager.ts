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

  public async speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.1; // Slightly higher pitch for Pihu
      utterance.volume = 1.0;

      utterance.onstart = () => {
        if (this.onSpeechStarted) this.onSpeechStarted();
      };

      utterance.onend = () => {
        if (this.onSpeechEnded) this.onSpeechEnded();
        resolve();
      };

      utterance.onerror = (e) => {
        console.error('[TTSManager] Speech error:', e);
        if (this.onSpeechEnded) this.onSpeechEnded();
        resolve(); // Resolve anyway so we don't block
      };

      this.synth.speak(utterance);
    });
  }

  public stop() {
    if (this.synth.speaking) {
      this.synth.cancel();
      if (this.onSpeechEnded) this.onSpeechEnded();
    }
  }
}
