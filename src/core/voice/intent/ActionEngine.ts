import { LLMManager } from '../../llm/LLMManager';
import { PIHU_CORE_IDENTITY } from './systemPrompt';
import { useLayoutStore } from '../../layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import type { Tool, FunctionCall } from '../../llm/types';

export class ActionEngine {
  private llm: LLMManager;

  constructor() {
    this.llm = LLMManager.getInstance();
  }

  private getDynamicContext(): string {
    const layoutState = useLayoutStore.getState();
    const musicState = useMusicStore.getState();

    const openWidgets = Object.entries(layoutState.widgets)
      .filter(([_, widget]) => widget.isOpen)
      .map(([id]) => id);

    const availableActions = this.getTools()[0].functionDeclarations.map(t => `${t.name}: ${t.description}`);

    const context = {
      os: "PIHU OS",
      workspace: "Development",
      user: "Mayank",
      available_widgets: [
        { id: "ytmusic-plugin", name: "YouTube Music Main Window" },
        { id: "music-widget", name: "Music Player (Square)" },
        { id: "music-widget-horizontal", name: "Music Player (Compact)" },
        { id: "music-widget-circle", name: "Music Player (Circle Disc)" },
        { id: "music-widget-folder", name: "Music Player (Glass Folder)" },
        { id: "clock-widget", name: "Clock Widget" },
        { id: "calendar-widget", name: "Calendar Widget (Grid)" },
        { id: "calendar-widget-compact", name: "Calendar Widget (Compact iOS Style)" },
        { id: "weather-widget-large", name: "Weather Widget (Large Detailed)" },
        { id: "weather-widget-compact", name: "Weather Widget (Compact Square)" },
        { id: "weather-widget-wide", name: "Weather Widget (Wide Forecast)" },
        { id: "weather-widget-hourly", name: "Weather Widget (Hourly Forecast)" },
        { id: "orb-widget", name: "AI Orb (Voice Indicator)" }
      ],
      open_widgets: openWidgets,
      music_player: {
        is_playing: musicState.isPlaying,
        current_track: musicState.trackInfo?.title || "None",
        artist: musicState.trackInfo?.artist || "None",
        is_authenticated: musicState.isYtAuthenticated
      },
      available_actions: availableActions,
      available_mcps: ["filesystem", "semantic-search", "workspace", "browser", "calendar", "automation"],
      capabilities: ["File Actions", "Semantic Search", "Automation", "Workspace Control", "Application Control"]
    };
    
    return `\n\nRUNTIME CONTEXT:\n${JSON.stringify(context, null, 2)}`;
  }

  private getTools(): Tool[] {
    return [
      {
        functionDeclarations: [
          {
            name: "control_widget",
            description: "Opens, closes, or toggles a desktop widget. Valid widget IDs are in your RUNTIME CONTEXT under available_widgets (e.g. 'music-widget-horizontal', 'ytmusic-plugin', 'clock-widget', etc.). Use this to add widgets from the tray or control window visibility.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: {
                  type: "STRING",
                  description: "The action to perform: 'open', 'close', or 'toggle'"
                },
                widget_id: {
                  type: "STRING",
                  description: "The exact ID of the widget from available_widgets (e.g., 'ytmusic-plugin')"
                }
              },
              required: ["action", "widget_id"]
            }
          },
          {
            name: "control_ytmusic",
            description: "Controls the YT Music player playback and actions.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: {
                  type: "STRING",
                  description: "The action to perform: 'play', 'pause', 'toggle', 'next', 'prev', 'search', 'play_playlist', 'login', 'logout'"
                },
                query: {
                  type: "STRING",
                  description: "The search query or playlist name if the action requires it"
                }
              },
              required: ["action"]
            }
          }
        ]
      }
    ];
  }

  private async executeFunctionCall(call: FunctionCall) {
    console.log('[ActionEngine] Executing function call:', call);
    
    if (call.name === 'control_widget') {
      const { action, widget_id } = call.args || {};
      const layoutStore = useLayoutStore.getState();
      
      const isOpen = layoutStore.widgets[widget_id]?.isOpen;
      
      if (action === 'open' && !isOpen) {
        layoutStore.toggleWidget(widget_id);
      } else if (action === 'close' && isOpen) {
        layoutStore.toggleWidget(widget_id);
      } else if (action === 'toggle') {
        layoutStore.toggleWidget(widget_id);
      }
    } else if (call.name === 'control_ytmusic') {
      const { action, query } = call.args || {};
      const musicStore = useMusicStore.getState();
      const layoutStore = useLayoutStore.getState();
      
      switch (action) {
        case 'play':
        case 'toggle':
          if (!layoutStore.widgets['ytmusic-plugin']?.isOpen && 
              !layoutStore.widgets['music-widget']?.isOpen &&
              !layoutStore.widgets['music-widget-circle']?.isOpen &&
              !layoutStore.widgets['music-widget-folder']?.isOpen) {
            layoutStore.toggleWidget('ytmusic-plugin');
          }
          musicStore.togglePlay();
          break;
        case 'next':
          musicStore.next();
          break;
        case 'prev':
          musicStore.prev();
          break;
        case 'search':
          if (query) {
             musicStore.setPlaylistId(query, 'search');
             // Optionally open the widget to show results
             if (!layoutStore.widgets['ytmusic-plugin']?.isOpen) {
               layoutStore.toggleWidget('ytmusic-plugin');
             }
          }
          break;
        case 'play_playlist':
          if (query) {
             musicStore.setPlaylistId(query, 'search');
             if (!layoutStore.widgets['ytmusic-plugin']?.isOpen) {
               layoutStore.toggleWidget('ytmusic-plugin');
             }
          }
          break;
        case 'login':
          // We can't do the whole auth flow in the background, so we just open the widget.
          if (!layoutStore.widgets['ytmusic-plugin']?.isOpen) {
            layoutStore.toggleWidget('ytmusic-plugin');
          }
          break;
        case 'logout':
          try {
            await fetch('http://127.0.0.1:48123/auth/logout', { method: 'POST' });
            musicStore.checkYtAuth();
          } catch (e) {
            console.error('Logout failed', e);
          }
          break;
      }
    }
  }

  public async processIntent(text: string): Promise<string> {
    try {
      const cleanText = text.trim();
      if (!cleanText || cleanText === '[BLANK_AUDIO]') {
        return "";
      }

      console.log('[ActionEngine] Processing intent:', cleanText);

      const fullSystemInstruction = PIHU_CORE_IDENTITY + this.getDynamicContext();

      const response = await this.llm.generatePrimaryTask({
        prompt: cleanText,
        systemInstruction: fullSystemInstruction,
        tools: this.getTools()
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          await this.executeFunctionCall(call);
        }
      }

      if (response.text) {
        return response.text;
      }

      // If the LLM failed to provide a text response but did execute a function, use a dynamic fallback
      if (response.functionCalls && response.functionCalls.length > 0) {
        const fallbacks = [
          "Done!",
          "All set.",
          "Sure thing.",
          "Got it.",
          "I've taken care of that."
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      return "I'm not quite sure how to help with that.";

    } catch (error) {
      console.error('[ActionEngine] Error processing intent:', error);
      return "I'm sorry, I'm having trouble connecting to my brain right now.";
    }
  }
}
