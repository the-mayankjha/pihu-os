export class STTManager {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording: boolean = false;
  
  public onTranscription: ((text: string) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  constructor() {}

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://127.0.0.1:5001');

      this.ws.onopen = () => {
        console.log('[SPEECH ENGINE - STT] 🟢 Connected to STT WebSocket server (ws://127.0.0.1:5001)');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcription') {
            console.log(`[SPEECH ENGINE - STT] 📝 Transcription Received: "${data.text}"`);
            if (this.onTranscription) {
              this.onTranscription(data.text);
            }
          } else if (data.type === 'error') {
             console.error(`[SPEECH ENGINE - STT] ❌ Server Error: ${data.message}`);
             if (this.onError) this.onError(data.message);
          }
        } catch (e) {
          console.error('[SPEECH ENGINE - STT] ❌ Error parsing message:', e, event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[SPEECH ENGINE - STT] ❌ WebSocket error:', error);
        if (this.onError) this.onError('WebSocket connection error');
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[SPEECH ENGINE - STT] 🔴 WebSocket connection closed');
      };
    });
  }

  public async startListening() {
    console.log('[SPEECH ENGINE - STT] 🔄 startListening() called');
    if (this.isRecording) {
      console.log('[SPEECH ENGINE - STT] ⚠️ Already recording, ignoring start request.');
      return;
    }
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[SPEECH ENGINE - STT] 🔌 WebSocket not open. Connecting...');
      await this.connect();
    }

    try {
      console.log('[SPEECH ENGINE - STT] 🎤 Requesting microphone access...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[SPEECH ENGINE - STT] ✅ Microphone access granted!');
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // Whisper expects 16kHz
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // We have Float32Array at 16kHz, exactly what whispercpp needs
        this.ws.send(inputData.buffer);
      };

      this.isRecording = true;
      console.log('[SPEECH ENGINE - STT] 🎙️ Started listening and streaming to WebSocket');
    } catch (err) {
      console.error('[SPEECH ENGINE - STT] ❌ Error accessing microphone:', err);
      if (this.onError) this.onError('Failed to access microphone');
    }
  }

  public stopListening() {
    if (!this.isRecording) return;
    this.isRecording = false;

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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[SPEECH ENGINE - STT] ⚙️ Requesting server to process accumulated audio');
      this.ws.send(JSON.stringify({ type: "process" }));
    }
  }
}
