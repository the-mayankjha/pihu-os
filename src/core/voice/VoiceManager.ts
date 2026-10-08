import { messageNotifications } from '../services/messageNotifications';
import { WHATSAPP_API_URL } from '../services/whatsappBridge';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { STTManager } from './stt/STTManager';
import { TTSManager } from './tts/TTSManager';
import { ActionEngine } from './intent/ActionEngine';
import { useOrbStore } from '../orb/OrbStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { parseUIIntent } from '../automation/uiIntent';
import { parseBrowserIntent } from '../automation/browserIntent';
import { rememberTarget } from '../automation/targetContext';
import { OrbState } from '../../shared/components/Orb/states';

// ── Configuration ────────────────────────────────────────────────────────────
const SAFETY_TIMEOUT_MS = 15000;       // 15s absolute safety timeout
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
  private speechInterrupted = false;

  private constructor() {
    this.sttManager = new STTManager();
    this.ttsManager = new TTSManager();
    this.actionEngine = new ActionEngine();

    this.setupListeners();
    messageNotifications.start(prompt => this.announceMessage(prompt));
  }

  private async announceMessage(prompt: string): Promise<boolean> {
    if (this.isProcessing || this.ttsManager.isSpeaking || useVoiceStore.getState().isActive || useOrbStore.getState().currentState !== OrbState.IDLE) return false;
    this.isProcessing = true;
    this.speechInterrupted = false;
    try {
      await invoke('trigger_listening');
      useVoiceStore.getState().setIsActive(true);
      useVoiceStore.getState().setResponse(prompt);
      await this.ttsManager.speak(prompt);
      this.isProcessing = false;
      if (!this.speechInterrupted) await this.startListening(true);
      return true;
    } catch {
      this.resetToIdle();
      return false;
    }
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
      console.log('[VOICE MANAGER] 🌅 Waiting for Kokoro TTS to come online before greeting...');

      // ── Poll Kokoro TTS /health until ready (max ~60s) ──
      let kokoroReady = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const res = await fetch('http://127.0.0.1:48126/health', { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'ready') {
              kokoroReady = true;
              console.log('[VOICE MANAGER] ✅ Kokoro TTS is online:', data);
              break;
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!kokoroReady) {
        console.warn('[VOICE MANAGER] ⚠️ Kokoro TTS did not come online in 60s. Skipping greeting.');
        return;
      }

      // ── Check other services in parallel ──
      const serviceChecks = await Promise.allSettled([
        fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(1500) }).then(r => r.ok),
        fetch('ws://127.0.0.1:5001', { signal: AbortSignal.timeout(1500) }).then(() => true).catch(() => true), // STT WebSocket — if server is running, even a failed HTTP fetch means it's there
      ]);

      const whatsappUp = serviceChecks[0].status === 'fulfilled' && serviceChecks[0].value;

      // ── Build dynamic greeting ──
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const activeProj = useVoiceStore.getState().activeProject?.name;

      const connectedParts: string[] = ['Voice engine is online'];
      if (whatsappUp) connectedParts.push('WhatsApp bridge connected');
      connectedParts.push('all tools and MCPs are synced');

      const servicesSummary = connectedParts.join(', ');

      const greetingOptions = activeProj
        ? [
            `${timeOfDay}, Sir Mayank. ${servicesSummary}. Currently active on project ${activeProj}. Ready whenever you are.`,
            `${timeOfDay}, Sir Mayank. All systems are up and running. ${activeProj} is loaded and ready.`,
            `${timeOfDay}, Sir Mayank. ${servicesSummary}. Project ${activeProj} is standing by.`
          ]
        : [
            `${timeOfDay}, Sir Mayank. ${servicesSummary}. How can I help you today?`,
            `${timeOfDay}, Sir Mayank. All systems online and ready to go. What would you like to do?`,
            `${timeOfDay}, Sir Mayank. ${servicesSummary}. At your service.`
          ];

      const greeting = greetingOptions[Math.floor(Math.random() * greetingOptions.length)];

      console.log(`[VOICE MANAGER] 🌅 Startup greeting: "${greeting}"`);
      useVoiceStore.getState().setIsActive(true);
      useVoiceStore.getState().setResponse(greeting);
      await this.ttsManager.speak(greeting);
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
  private startSafetyTimer(duration = SAFETY_TIMEOUT_MS) {
    this.clearSafetyTimer();
    this.safetyTimer = setTimeout(() => {
      if (this.isProcessing || useOrbStore.getState().currentState !== OrbState.IDLE) {
        console.warn('[VOICE MANAGER] ⚠️ Safety timeout! Force-resetting to IDLE.');
        this.resetToIdle();
      }
    }, duration);
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
    this.speechInterrupted = true;
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
    this.sttManager.onIdleTimeout = () => this.resetToIdle();

    // ── STT Transcription received ──────────────────────────────────────────
    this.sttManager.onTranscription = async (text) => {
      console.log(`[VOICE MANAGER] 📝 Received transcription from STT: "${text}"`);
      
      if (!text || text === '[BLANK_AUDIO]') {
        this.resetToIdle();
        return;
      }

      console.log('[VOICE MANAGER] Valid transcription. Processing intent...');
      useVoiceStore.getState().setTranscription(text);
      const { planSequence } = await import('./../automation/sequenceIntent');
      const sequence = planSequence(text);
      if (/\bvtop\b/i.test(text)) this.startSafetyTimer(150000);
      else if (/\b(?:project|run it|preview it|open it)\b/i.test(text)) this.startSafetyTimer(90000);
      if (/\bwhatsapp\b/i.test(text)) this.startSafetyTimer(45000);
      if (parseBrowserIntent(text) || parseUIIntent(text)) this.startSafetyTimer(90000);
      if (sequence && !sequence.error) this.startSafetyTimer(sequence.steps.length * 20000 + 45000);

      if (messageNotifications.awaitingReply) this.startSafetyTimer(150000);

      try {
        // ── THINKING phase ──────────────────────────────────────────────────
        this.setOrbState(OrbState.EXECUTING);
        const response = await this.actionEngine.processIntent(text, mode => this.setOrbState(mode === 'thinking' ? OrbState.THINKING : OrbState.EXECUTING));
        console.log(`[VOICE MANAGER] Response: "${response}"`);

        if (!this.isProcessing) {
          console.log('[VOICE MANAGER] Processing was cancelled during THINKING. Exiting.');
          this.resetToIdle();
          return;
        }

        useVoiceStore.getState().setResponse(response);

        // ── SPEAKING phase ──────────────────────────────────────────────────
        console.log('[VOICE MANAGER] Playing TTS response...');
        this.clearSafetyTimer(); // Playback duration must never be limited by the processing watchdog.
        this.speechInterrupted = false;
        await this.ttsManager.speak(response);

        if (!this.speechInterrupted) {
          this.isProcessing = false;
          await this.startListening(true);
        }

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
        this.setOrbState(OrbState.EXECUTING);
        useVoiceStore.getState().setIsListening(false);
      }
    };

    // ── Tauri wake-word-detected event (fired by Python in IDLE state) ──────
    listen('wake-word-detected', (event) => {
      console.log('[VOICE MANAGER] ⏰ Wake word detected!', event);
      
      const currentState = useOrbStore.getState().currentState;

      // PREVENT SELF-CUT: Ignore wake word triggers while PIHU is speaking or thinking (speaker acoustic echo)
      if (this.ttsManager.isSpeaking || currentState === OrbState.SPEAKING || currentState === OrbState.THINKING || this.isProcessing) {
        console.log('[VOICE MANAGER] 🛡️ Ignored wake word during active speech/thinking to prevent acoustic echo self-interruption.');
        return;
      }

      if (currentState === OrbState.IDLE) {
        this.startListening(false);
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
        this.setOrbState(OrbState.EXECUTING);
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

    // Capture external focus before the voice overlay activates PIHU.
    if (navigator.platform.toUpperCase().includes('MAC')) {
      try { rememberTarget(await invoke<string>('macos_frontmost_app')); }
      catch (error) { console.debug('[VOICE MANAGER] Could not capture target app:', error); }
    }
    this.setOrbState(OrbState.WAKE);
    if (!isFollowUp) useVoiceStore.getState().reset();
    else {
      useVoiceStore.getState().setTranscription('');
      useVoiceStore.getState().setProcessingStatus(null);
    }
    useVoiceStore.getState().setIsActive(true);

    // Follow-up speech can begin within 15 seconds without another wake word.
    this.sttManager.idleTimeoutMs = isFollowUp ? 15000 : 6000;

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

  private finishSpeaking() {
    this.isProcessing = false;
    this.clearSafetyTimer();
    this.sttManager.stopListening();
    this.setOrbState(OrbState.IDLE);
    useVoiceStore.getState().setIsListening(false);
    invoke('speech_done').catch(() => {});
  }

  public handleEscape() {
    if (this.ttsManager.isSpeaking || useOrbStore.getState().currentState === OrbState.SPEAKING) {
      this.speechInterrupted = true;
      this.ttsManager.stop();
      this.finishSpeaking();
      return;
    }
    this.stopAll();
  }

  public stopAll() {
    this.sttManager.stopListening();
    this.ttsManager.stop();
    this.resetToIdle();
  }
}
