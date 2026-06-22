import { LLMManager } from '../../llm/LLMManager';
import { PIHU_CORE_IDENTITY } from './systemPrompt';

export class ActionEngine {
  private llm: LLMManager;

  constructor() {
    this.llm = LLMManager.getInstance();
  }

  private getDynamicContext(): string {
    // In a real implementation, these would be fetched from OS state managers dynamically
    const context = {
      os: "PIHU OS",
      workspace: "Development",
      theme: "Dark Frost",
      user: "Mayank",
      active_app: "YT Music",
      focused_window: "Current Player",
      open_apps: ["YT Music", "FKVim", "Terminal"],
      available_mcps: ["filesystem", "semantic-search", "workspace", "browser", "calendar", "automation"],
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

      // Route through the primary task model
      const response = await this.llm.generatePrimaryTask({
        prompt: cleanText,
        systemInstruction: fullSystemInstruction
      });

      return response;

    } catch (error) {
      console.error('[ActionEngine] Error processing intent:', error);
      return "I'm sorry, I'm having trouble connecting to my brain right now.";
    }
  }
}
