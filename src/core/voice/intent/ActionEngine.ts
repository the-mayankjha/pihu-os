import { LLMManager } from '../../llm/LLMManager';
import { PIHU_CORE_IDENTITY } from './systemPrompt';
import { buildGeminiTools, executeTool } from './tools/index';
import { handlePendingWhatsAppConfirmation } from './tools/whatsappTools';
import { useLayoutStore } from '../../layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useMemplaceStore } from '../../memory/MemplaceStore';
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
    const memplaceState = useMemplaceStore.getState();
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

    const continuousWorkHours = memplaceState.getContinuousWorkHours();
    const healthWarning = memplaceState.getHealthWarning();
    const session = memplaceState.sessionContext;

    const activeProj = memplaceState.activeProject || (voiceState.activeProject ? {
      name: voiceState.activeProject.name,
      dir: voiceState.activeProject.dir,
      url: voiceState.activeProject.url,
      port: voiceState.activeProject.port,
      status: 'active' as const,
      lastActive: new Date().toISOString()
    } : null);

    const context = {
      os: "PIHU OS",
      user: primaryAccount?.name ? `Sir ${primaryAccount.name}` : "Sir Mayank",
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
      active_project: activeProj ? {
        name: activeProj.name,
        directory: activeProj.dir,
        dev_server_url: activeProj.url || `http://localhost:${activeProj.port || 5180}`,
        dev_server_port: activeProj.port || 5180,
        status: "Active"
      } : {
        name: "None",
        directory: "/Users/mayankjha/Documents/projects",
        dev_server_url: "None",
        dev_server_port: null
      },
      memplace_memory: {
        active_project: activeProj,
        recent_projects: memplaceState.projectHistory.slice(0, 10),
        session_context: {
          continuous_work_hours: continuousWorkHours,
          health_warning: healthWarning,
          open_files: session.openFiles,
          crashed_files: session.crashedFiles,
          clean_shutdown: session.cleanShutdown,
          session_start_time: new Date(session.startTime).toLocaleTimeString()
        }
      },
      people_directory: (settingsState.contacts || []).map(c => ({
        name: c.name,
        nickname: c.nickname || null,
        email: c.email || null,
        phone: c.phone || null,
        notes: c.notes || null
      })),
      whatsapp_integration: {
        mcp_server: "pihu-whatsapp-mcp",
        bridge_status: "FastMCP + whatsmeow REST (Port 8080)",
        device_name: "PIHU Desktop",
        capabilities: ["Send WhatsApp Message", "Search WhatsApp Contacts & Groups", "List Chats", "Pair Phone via QR Code"]
      },
      available_mcps: ["pihu-file-mcp", "pihu-system-mcp", "pihu-google-workspace-mcp", "pihu-whatsapp-mcp", "web-search-mcp", "memplace-mcp", "memory", "fetch"],
      capabilities: ["Complex React Project Scaffolding", "File Actions", "Real-time Folder Opening", "Google Workspace Integration", "WhatsApp Messaging & QR Pairing", "Token Key Rotation", "Semantic Search", "MemPalace Memory & Session Resumption", "Host Server & Consequence Awareness", "Automation", "Workspace Control"]
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

      // Resolve a pending fuzzy WhatsApp recipient before starting a new LLM turn.
      const pendingConfirmation = await handlePendingWhatsAppConfirmation(cleanText);
      if (pendingConfirmation) {
        this.conversationHistory.push({ role: 'user', parts: [{ text: cleanText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: pendingConfirmation }] });
        return pendingConfirmation;
      }

      useVoiceStore.getState().setProcessingStatus("Analyzing request & planning actions...");

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

  /** Inject a system-level note into conversation history (e.g., interruption context). */
  public addSystemNote(note: string): void {
    this.conversationHistory.push({ role: 'user', parts: [{ text: note }] });
    // Trim if needed
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }
}
