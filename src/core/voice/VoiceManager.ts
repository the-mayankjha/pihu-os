import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { STTManager } from './stt/STTManager';
import { TTSManager } from './tts/TTSManager';
import { ActionEngine } from './intent/ActionEngine';
import { useOrbStore } from '../orb/OrbStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { OrbState } from '../../shared/components/Orb/states';

// ── Configuration ────────────────────────────────────────────────────────────
const SAFETY_TIMEOUT_MS = 90000;       // 90s absolute safety timeout
const VAD_DEDUP_MS        = 500;         // Dedup window for VAD events

export class VoiceManager {
  private static instance: VoiceManager;
  
  private sttManager: STTManager;
  private ttsManager: TTSManager;
  private actionEngine: ActionEngine;

  private isProcessing: boolean = false;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private lastVadTimestamp: number = 0;  // Dedup guard for VAD events
  private hasGreeted: boolean = false;

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

  public async triggerStartupGreeting() {
    if (this.hasGreeted || this.isProcessing) return;
    this.hasGreeted = true;

    try {
      console.log('[VOICE MANAGER] 🌅 Generating opening startup greeting...');
      this.isProcessing = true;
      this.setOrbState(OrbState.THINKING);

      const response = await this.actionEngine.processIntent(
        "Greet Sir Mayank warmly on opening PIHU OS. Acknowledge time of day, active project from RUNTIME CONTEXT, and session resumption state or health warnings if applicable. Keep response elegant, concise, and natural (max 2 sentences)."
      );

      if (response && response.trim()) {
        useVoiceStore.getState().setIsActive(true);
        useVoiceStore.getState().setResponse(response);
        await this.ttsManager.speak(response);
      }
    } catch (err) {
      console.warn('[VOICE MANAGER] Startup greeting error:', err);
    } finally {
      this.resetToIdle();
    }
  }

  private setOrbState(state: OrbState) {
    useOrbStore.getState().setState(state);
  }

  // ── Safety timeout: auto-reset if isProcessing gets stuck ────────────────
  private startSafetyTimer() {
    this.clearSafetyTimer();
    this.safetyTimer = setTimeout(() => {
      if (this.isProcessing || useOrbStore.getState().currentState !== OrbState.IDLE) {
        console.warn('[VOICE MANAGER] ⚠️ Safety timeout! Force-resetting to IDLE.');
        this.resetToIdle();
      }
    }, SAFETY_TIMEOUT_MS);
  }

  private clearSafetyTimer() {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  /** Clean reset to IDLE state — stops browser mic, sets Orb IDLE, signals Python to resume wake word. */
  public resetToIdle() {
    console.log('[VOICE MANAGER] 🔄 Resetting to IDLE state.');
    this.isProcessing = false;
    this.clearSafetyTimer();
    this.sttManager.stopListening();
    this.setOrbState(OrbState.IDLE);
    useVoiceStore.getState().reset();
    invoke('speech_done').catch(e =>
      console.warn('[VOICE MANAGER] speech_done invoke failed:', e)
    );
  }

  private setupListeners() {

    // ── STT Transcription received ──────────────────────────────────────────
    this.sttManager.onTranscription = async (text) => {
      console.log(`[VOICE MANAGER] 📝 Received transcription from STT: "${text}"`);
      
      if (!text || text === '[BLANK_AUDIO]') {
        console.log('[VOICE MANAGER] Transcription empty or blank. Preserving active response overlay.');
        this.isProcessing = false;
        this.clearSafetyTimer();
        this.sttManager.stopListening();
        this.setOrbState(OrbState.IDLE);
        useVoiceStore.getState().setIsListening(false);
        invoke('speech_done').catch(() => {});

        // Auto-hide response overlay after 8 seconds of idle time if no new voice interaction
        if (useVoiceStore.getState().response) {
          setTimeout(() => {
            if (useOrbStore.getState().currentState === OrbState.IDLE && !this.isProcessing) {
              useVoiceStore.getState().reset();
            }
          }, 8000);
        } else {
          useVoiceStore.getState().reset();
        }
        return;
      }

      console.log('[VOICE MANAGER] Valid transcription. Processing intent...');
      useVoiceStore.getState().setTranscription(text);

      try {
        // ── THINKING phase ──────────────────────────────────────────────────
        this.setOrbState(OrbState.THINKING);
        const response = await this.actionEngine.processIntent(text);
        console.log(`[VOICE MANAGER] Response: "${response}"`);

        if (!this.isProcessing) {
          console.log('[VOICE MANAGER] Processing was cancelled during THINKING. Exiting.');
          this.resetToIdle();
          return;
        }

        useVoiceStore.getState().setResponse(response);

        // ── SPEAKING phase ──────────────────────────────────────────────────
        console.log('[VOICE MANAGER] Playing TTS response...');
        await this.ttsManager.speak(response);

        // ── Post-speech: follow-up or idle ──────────────────────────────────
        if (this.ttsManager.wasInterrupted) {
          console.log('[VOICE MANAGER] TTS was stopped by user. Resetting to IDLE.');
          this.resetToIdle();
          return;
        }

        console.log('[VOICE MANAGER] TTS finished naturally. Starting 10s follow-up listening.');
        this.isProcessing = false;
        this.clearSafetyTimer();
        
        // Enter 10s follow-up listening mode
        this.startListening(true);

      } catch (error) {
        console.error('[VOICE MANAGER] ❌ Error in transcription handler:', error);
        this.resetToIdle();
      }
    };

    // ── Browser VAD: speech ended (primary path) ────────────────────────────
    this.sttManager.onSpeechEnded = () => {
      const now = Date.now();
      if (now - this.lastVadTimestamp < VAD_DEDUP_MS) {
        console.log('[VOICE MANAGER] Dedup: ignoring duplicate VAD event.');
        return;
      }
      this.lastVadTimestamp = now;

      console.log('[VOICE MANAGER] 🛑 Browser VAD: speech ended!');
      if (!this.isProcessing) {
        this.isProcessing = true;
        this.startSafetyTimer();
        this.setOrbState(OrbState.THINKING);
        useVoiceStore.getState().setIsListening(false);
      }
    };

    // ── Tauri wake-word-detected event (fired by Python in IDLE state) ──────
    listen('wake-word-detected', (event) => {
      console.log('[VOICE MANAGER] ⏰ Wake word detected!', event);
      
      const currentState = useOrbStore.getState().currentState;
      if (currentState === OrbState.IDLE && !this.isProcessing) {
        this.startListening(false);
      } else if (currentState === OrbState.SPEAKING || this.ttsManager.isSpeaking) {
        // Interrupted during speech
        console.log('[VOICE MANAGER] 🔇 Interrupted during speech! Stopping TTS.');
        this.ttsManager.stop();
        this.resetToIdle();
      } else {
        console.log('[VOICE MANAGER] Ignored wake word — current state:', currentState, 'isProcessing:', this.isProcessing);
      }
    });

    // ── Tauri speech-ended fallback ──────────────────────────────────────
    listen('speech-ended', () => {
      const now = Date.now();
      if (now - this.lastVadTimestamp < VAD_DEDUP_MS) {
        return;
      }
      this.lastVadTimestamp = now;

      console.log('[VOICE MANAGER] 🛑 Tauri fallback: speech-ended received.');
      if (useVoiceStore.getState().isListening && !this.isProcessing) {
        this.isProcessing = true;
        this.startSafetyTimer();
        this.setOrbState(OrbState.THINKING);
        useVoiceStore.getState().setIsListening(false);
        this.sttManager.stopListening();
        this.sttManager.processAudio();
      }
    });

    // ── STT Error ──────────────────────────────────────────────────────────
    this.sttManager.onError = (error) => {
      console.error('[VOICE MANAGER] ❌ STT Error:', error);
      this.resetToIdle();
    };

    // ── TTS Started callback ───────────────────────────────────────────────
    this.ttsManager.onSpeechStarted = () => {
      this.setOrbState(OrbState.SPEAKING);
    };
  }

  public async startListening(isFollowUp: boolean = false) {
    console.log(`[VOICE MANAGER] 🎙️ startListening(${isFollowUp ? 'follow-up' : 'fresh'})`);
    this.ttsManager.stop();
    
    // Stop any active STT session before starting new one
    this.sttManager.stopListening();

    this.setOrbState(OrbState.WAKE);
    useVoiceStore.getState().reset();
    useVoiceStore.getState().setIsActive(true);

    // Idle timeout: 10s for follow-up, 6s for fresh wake word
    this.sttManager.idleTimeoutMs = isFollowUp ? 10000 : 6000;

    // Tell Python to pause its mic capture stream
    try {
      await invoke('trigger_listening');
    } catch (e) {
      console.error('[VOICE MANAGER] Failed to pause Python wake word stream:', e);
    }

    this.setOrbState(OrbState.LISTENING);
    useVoiceStore.getState().setIsListening(true);
    await this.sttManager.startListening();
  }

  public stopListening() {
    this.sttManager.stopListening();
    if (!this.isProcessing) {
      this.resetToIdle();
    }
  }

  public stopAll() {
    this.sttManager.stopListening();
    this.ttsManager.stop();
    this.resetToIdle();
  }
}
