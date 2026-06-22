import { LLMManager } from '../../llm/LLMManager';
import { PIHU_CORE_IDENTITY } from './systemPrompt';
import { buildGeminiTools, executeTool } from './tools/index';
import { useLayoutStore } from '../../layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import { getGlobalSystemStats } from '../../../widgets/system/useSystemMonitor';

export class ActionEngine {
  private llm: LLMManager;

  constructor() {
    this.llm = LLMManager.getInstance();
  }

  private getDynamicContext(): string {
    const layoutState = useLayoutStore.getState();
    const musicState = useMusicStore.getState();
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

    const context = {
      os: "PIHU OS",
      user: "Mayank",
      theme: "Dark Frost",
      system_performance: sysInfo,
      open_apps: openApps.length > 0 ? openApps : ["None"],
      focused_app: openApps.length > 0 ? openApps[openApps.length - 1] : "None",
      currently_playing_music: musicState.isPlaying 
        ? `${musicState.trackInfo.title} by ${musicState.trackInfo.artist}` 
        : "Nothing playing",
      available_mcps: ["filesystem", "semantic-search", "browser"],
      capabilities: ["File Actions", "Semantic Search", "Automation", "Workspace Control", "Application Control"]
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

      // Route through the tool-capable generation pipeline
      const response = await this.llm.generateWithTools(
        {
          prompt: cleanText,
          systemInstruction: fullSystemInstruction,
          tools: buildGeminiTools()
        },
        executeTool
      );

      return response;

    } catch (error: any) {
      console.error('[ActionEngine] Error processing intent:', error);
      return `Error: ${error?.message || String(error)}`;
    }
  }
}
