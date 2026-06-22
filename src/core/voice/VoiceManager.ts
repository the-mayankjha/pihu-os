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
      // Don't process empty transcriptions
      if (!text || text === '[BLANK_AUDIO]') {
        console.log('[VOICE MANAGER] Transcription is empty or BLANK_AUDIO. Aborting processing and resetting state.');
        this.setOrbState(OrbState.IDLE);
        useVoiceStore.getState().reset();
        this.isProcessing = false;
        return;
      }

      console.log('[VOICE MANAGER] Valid transcription received. Transitioning to THINKING state.');

      useVoiceStore.getState().setTranscription(text);
      // isListening is already set to false by speech-ended
      // isProcessing is already set to true by speech-ended
      // OrbState is already THINKING

      
      const response = await this.actionEngine.processIntent(text);
      
      console.log(`[VOICE MANAGER] ActionEngine returned response: "${response}"`);
      useVoiceStore.getState().setResponse(response);
      
      console.log('[VOICE MANAGER] Transitioning to SPEAKING state.');
      this.setOrbState(OrbState.SPEAKING);
      await this.ttsManager.speak(response);
      
      // If we are still processing, it means speech finished naturally (wasn't cancelled)
      if (this.isProcessing) {
        console.log('[VOICE MANAGER] TTS finished speaking naturally. Starting follow-up conversation.');
        this.isProcessing = false;
        this.startListening(true);
      } else {
        console.log('[VOICE MANAGER] Processing was cancelled during speech.');
      }
    };

    // Listen to Tauri wake word event
    listen('wake-word-detected', (event) => {
      console.log('[VOICE MANAGER] ⏰ Wake word detected by Tauri!', event);
      if (!this.isProcessing) {
        console.log('[VOICE MANAGER] Triggering startListening()');
        this.startListening();
      } else {
        console.log('[VOICE MANAGER] Ignored Wake word because system is currently processing.');
      }
    });

    // Listen to Tauri speech ended event (VAD from backend)
    listen('speech-ended', () => {
      console.log('[VOICE MANAGER] 🛑 Speech ended detected by Tauri VAD!');
      if (useVoiceStore.getState().isListening) {
         console.log('[VOICE MANAGER] Instructing STT to process accumulated audio');
         // We are now processing
         this.isProcessing = true;
         this.setOrbState(OrbState.THINKING);
         useVoiceStore.getState().setIsListening(false);
         
         this.sttManager.stopListening();
         this.sttManager.processAudio();
      }
    });

    this.sttManager.onError = (error) => {
      console.error('[VOICE MANAGER] ❌ STT Error caught:', error);
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
    
    // Slight delay to allow the Wake animation before listening
    setTimeout(async () => {
      console.log('[VOICE MANAGER] Entering LISTENING state. Instructing STTManager to listen.');
      this.setOrbState(OrbState.LISTENING);
      useVoiceStore.getState().setIsListening(true);
      await this.sttManager.startListening();
    }, 400);
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
