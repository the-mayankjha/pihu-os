import { LLMManager } from '../../llm/LLMManager';
import { PIHU_CORE_IDENTITY } from './systemPrompt';
import { buildGeminiTools, executeTool } from './tools/index';
import { useLayoutStore } from '../../layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { getGlobalSystemStats } from '../../../widgets/system/useSystemMonitor';
import type { GeminiContent } from '../../llm/types';

export class ActionEngine {
  private llm: LLMManager;
  private conversationHistory: GeminiContent[] = [];

  constructor() {
    this.llm = LLMManager.getInstance();
  }

  private getDynamicContext(): string {
    const layoutState = useLayoutStore.getState();
    const musicState = useMusicStore.getState();
    const voiceState = useVoiceStore.getState();
    const settingsState = useSettingsStore.getState();
    const systemStats = getGlobalSystemStats();

    // Map open widgets/apps
    const openApps = Object.entries(layoutState.widgets)
      .filter(([_, state]) => state.isOpen)
      .map(([id]) => id);

    let sysInfo: any = { status: "Unknown" };
    if (systemStats) {
      const memUsedGB = (systemStats.mem_used / (1024 ** 3)).toFixed(1);
      const memTotalGB = (systemStats.mem_total / (1024 ** 3)).toFixed(1);
      sysInfo = {
        cpu_usage: `${systemStats.cpu_usage.toFixed(0)}%`,
        ram: `${memUsedGB} / ${memTotalGB} GB`,
        battery: systemStats.battery ? `${systemStats.battery.percentage}%` : "Desktop/Unknown",
        cpu_frequency: `${(systemStats.cpu_frequency / 1000).toFixed(2)} GHz`,
        active_processes: systemStats.total_processes
      };
    }

    const connectedAccounts = settingsState.connectedGoogleAccounts || [];
    const primaryAccount = connectedAccounts.find(a => a.isPrimary) || connectedAccounts[0];

    const googleWorkspaceContext = {
      is_connected: settingsState.googleAccountConnected || connectedAccounts.length > 0,
      total_linked_accounts: connectedAccounts.length,
      primary_email: primaryAccount?.email || "the.mayank.k.jha@gmail.com",
      primary_name: primaryAccount?.name || "Mayank Jha",
      connected_accounts: connectedAccounts.map(a => ({
        email: a.email,
        name: a.name,
        is_primary: !!a.isPrimary
      })),
      status_message: connectedAccounts.length > 0 
        ? `Linked with ${connectedAccounts.length} account(s). Primary: ${primaryAccount?.email || "the.mayank.k.jha@gmail.com"}`
        : "Google Workspace is connected and ready."
    };

    const context = {
      os: "PIHU OS",
      user: primaryAccount?.name || "Mayank",
      theme: "Dark Frost",
      system_performance: sysInfo,
      open_apps: openApps.length > 0 ? openApps : ["None"],
      focused_app: openApps.length > 0 ? openApps[openApps.length - 1] : "None",
      currently_playing_music: musicState.isPlaying 
        ? `${musicState.trackInfo.title} by ${musicState.trackInfo.artist}` 
        : "Nothing playing",
      google_workspace: googleWorkspaceContext,
      pihu_token_protocol: {
        total_gemini_keys_configured: settingsState.geminiApiKeys.length,
        active_key_index: settingsState.activeKeyIndex,
        exhausted_keys_count: settingsState.exhaustedKeyIndices.length,
        is_protocol_active: settingsState.geminiApiKeys.length > 0,
      },
      voice_engine: {
        active: voiceState.activeVoiceEngine,
        voice_name: voiceState.activeVoiceName || "Unknown",
        last_error: voiceState.lastTTSError || "No error recorded yet.",
        is_elevenlabs_configured: !!settingsState.elevenLabsApiKey || !!import.meta.env.VITE_ELEVENLABS_API_KEY
      },
      available_mcps: ["pihu-file-mcp", "pihu-system-mcp", "pihu-google-workspace-mcp", "web-search-mcp", "memory", "fetch"],
      capabilities: ["File Actions", "Real-time Folder Opening", "Google Workspace Integration (Gmail, Calendar, Docs, Drive)", "Token Key Rotation", "Semantic Search", "Automation", "Workspace Control"]
    };

    return `\n\nRUNTIME CONTEXT:\n${JSON.stringify(context, null, 2)}`;
  }

  public async processIntent(text: string): Promise<string> {
    try {
      // Clean text
      const cleanText = text.trim();
      if (!cleanText || cleanText === '[BLANK_AUDIO]') {
        return "";
      }

      console.log('[ActionEngine] Processing intent:', cleanText);

      const fullSystemInstruction = PIHU_CORE_IDENTITY + this.getDynamicContext();

      // Keep last 10 turns of conversation history in memory for continuous conversation context
      const historyToPass = this.conversationHistory.slice(-10);

      // Route through the tool-capable generation pipeline with history memory
      const response = await this.llm.generateWithTools(
        {
          prompt: cleanText,
          systemInstruction: fullSystemInstruction,
          history: historyToPass,
          tools: buildGeminiTools()
        },
        executeTool
      );

      // Retain memory of user prompt and Pihu response
      if (response && response.trim()) {
        this.conversationHistory.push({ role: 'user', parts: [{ text: cleanText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: response }] });
        
        // Trim history to maximum 20 turns
        if (this.conversationHistory.length > 20) {
          this.conversationHistory = this.conversationHistory.slice(-20);
        }
      }

      return response;

    } catch (error: any) {
      console.error('[ActionEngine] Error processing intent:', error);
      return `Error: ${error?.message || String(error)}`;
    }
  }

  public clearHistory(): void {
    this.conversationHistory = [];
  }
}
