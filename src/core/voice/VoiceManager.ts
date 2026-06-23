import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { STTManager } from './stt/STTManager';
import { TTSManager } from './tts/TTSManager';
import { ActionEngine } from './intent/ActionEngine';
import { useOrbStore } from '../orb/OrbStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { OrbState } from '../../shared/components/Orb/states';

export class VoiceManager {
  private static instance: VoiceManager;
  
  private sttManager: STTManager;
  private ttsManager: TTSManager;
  private actionEngine: ActionEngine;

  private isProcessing: boolean = false;

  private constructor() {
    this.sttManager = new STTManager();
    this.ttsManager = new TTSManager();
    this.actionEngine = new ActionEngine();

    this.setupListeners();
  }

  public static getInstance(): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager();
    }
    return VoiceManager.instance;
  }

  private setOrbState(state: OrbState) {
    useOrbStore.getState().setState(state);
  }

  private setupListeners() {
    this.sttManager.onTranscription = async (text) => {
      console.log(`[VOICE MANAGER] Received transcription from STT: "${text}"`);
      if (!text || text === '[BLANK_AUDIO]') {
        console.log('[VOICE MANAGER] Transcription empty or blank. Resetting.');
        this.setOrbState(OrbState.IDLE);
        useVoiceStore.getState().reset();
        this.isProcessing = false;
        return;
      }

      console.log('[VOICE MANAGER] Valid transcription. Processing intent...');
      useVoiceStore.getState().setTranscription(text);

      const response = await this.actionEngine.processIntent(text);
      console.log(`[VOICE MANAGER] Response: "${response}"`);
      useVoiceStore.getState().setResponse(response);

      // State remains THINKING until the audio actually starts playing.
      // TTSManager will trigger onSpeechStarted which sets the state to SPEAKING.
      await this.ttsManager.speak(response);

      if (this.isProcessing) {
        console.log('[VOICE MANAGER] TTS done. Starting follow-up conversation.');
        this.isProcessing = false;
        this.startListening(true);
      } else {
        console.log('[VOICE MANAGER] Processing cancelled during speech.');
      }
    };

    // ── Browser VAD path (primary) ────────────────────────────────────────
    // STTManager detects silence itself and fires this callback.
    this.sttManager.onSpeechEnded = () => {
      console.log('[VOICE MANAGER] 🛑 Browser VAD: speech ended!');
      if (!this.isProcessing) {
        this.isProcessing = true;
        this.setOrbState(OrbState.THINKING);
        useVoiceStore.getState().setIsListening(false);
        // STTManager already called stopListening() + processAudio() internally
        // Signal wakeword.py to resume its PyAudio stream
        invoke('speech_done').catch(e =>
          console.warn('[VOICE MANAGER] speech_done invoke failed:', e)
        );
      }
    };

    // ── Tauri wakeword event ──────────────────────────────────────────────
    listen('wake-word-detected', (event) => {
      console.log('[VOICE MANAGER] ⏰ Wake word detected!', event);
      if (!this.isProcessing) {
        this.startListening();
      } else {
        console.log('[VOICE MANAGER] Ignored wake word — currently processing.');
      }
    });

    // ── Tauri speech-ended event (FALLBACK only) ──────────────────────────
    // Fires if wakeword.py's 8-second timeout expires before browser VAD fires.
    listen('speech-ended', () => {
      console.log('[VOICE MANAGER] 🛑 Tauri fallback: speech-ended received.');
      if (useVoiceStore.getState().isListening && !this.isProcessing) {
        this.isProcessing = true;
        this.setOrbState(OrbState.THINKING);
        useVoiceStore.getState().setIsListening(false);
        this.sttManager.stopListening();
        this.sttManager.processAudio();
        invoke('speech_done').catch(e =>
          console.warn('[VOICE MANAGER] speech_done invoke failed:', e)
        );
      }
    });

    this.sttManager.onError = (error) => {
      console.error('[VOICE MANAGER] ❌ STT Error:', error);
      this.setOrbState(OrbState.IDLE);
      useVoiceStore.getState().reset();
      this.isProcessing = false;
    };

    this.ttsManager.onSpeechStarted = () => {
      this.setOrbState(OrbState.SPEAKING);
    };
  }

  public async startListening(isFollowUp: boolean = false) {
    console.log('[VOICE MANAGER] startListening() invoked. Preparing UI and WAKE state.');
    this.ttsManager.stop();
    this.setOrbState(OrbState.WAKE);
    
    // Prepare UI Overlay
    useVoiceStore.getState().reset();
    useVoiceStore.getState().setIsActive(true);

    if (isFollowUp) {
      // Manually trigger the python VAD engine to bypass Wake Word
      try {
        await invoke('trigger_listening');
      } catch (e) {
        console.error('[VOICE MANAGER] Failed to trigger manual listening in backend:', e);
      }
    }
    
    // Start mic capture immediately — do NOT wait for the WAKE animation.
    // The 400ms delay caused SPEECH_ENDED to fire before we even opened the mic,
    // resulting in blank audio being sent to Whisper.
    // We transition to LISTENING state in parallel so the animation still plays.
    console.log('[VOICE MANAGER] Entering LISTENING state and capturing mic immediately.');
    this.setOrbState(OrbState.LISTENING);
    useVoiceStore.getState().setIsListening(true);
    await this.sttManager.startListening();
  }

  public stopListening() {
    this.sttManager.stopListening();
    if (!this.isProcessing) {
      this.setOrbState(OrbState.IDLE);
      useVoiceStore.getState().reset();
    }
  }

  public stopAll() {
    this.sttManager.stopListening();
    this.ttsManager.stop();
    this.isProcessing = false;
    this.setOrbState(OrbState.IDLE);
    useVoiceStore.getState().reset();
  }
}
