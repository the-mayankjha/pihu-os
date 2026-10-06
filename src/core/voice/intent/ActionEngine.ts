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

  private normalizePreLLM(text: string): string {
    let clean = text.trim();
    // Remove Whisper sound hallucination tags
    clean = clean.replace(/\([^\)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
    // Normalize speech artifacts & acoustic variants
    clean = clean.replace(/\b(?:for\s+pa|for\s+pawpa|to\s+pa)\b/gi, 'to papa');
    clean = clean.replace(/\b(?:pappa|paapa|pawpa|buh[\s-]*buh|buhbuh|bubba|bapa)\b/gi, 'papa');
    clean = clean.replace(/\b(?:mumma|mommy|amma)\b/gi, 'mummy');
    clean = clean.replace(/\b(?:bhaya|bhiya)\b/gi, 'bhaiya');
    return clean;
  }

  private normalizePostLLM(text: string): string {
    if (!text) return "";
    let clean = text;
    // Strip markdown formatting for clean TTS and VoiceOverlay
    clean = clean.replace(/\*\*/g, '');
    clean = clean.replace(/\*/g, '');
    clean = clean.replace(/#/g, '');
    clean = clean.replace(/`/g, '');
    clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    clean = clean.replace(/>/g, '');
    clean = clean.replace(/---/g, '');
    return clean.trim();
  }

  private pickRandom(options: string[]): string {
    return options[Math.floor(Math.random() * options.length)];
  }

  private async tryFastDirectIntent(text: string): Promise<string | null> {
    const lower = text.toLowerCase().trim();
    const isHindi = /[\u0900-\u097F]/.test(text) || /\b(kya|tum|kr|karo|karti|karta|ho|hoon|kholo|chalao|band|badhao|kam|bhejo|sunao|abhi|kardo|kar do|dikhao|batao|bataiye|rok|roko|gaana|gana|waqt|samay|aaj)\b/i.test(lower);

    // ─── 0. Contextual Project Actions ("then open it", "run it", "preview it") ───
    if (/\b(?:then\s+open\s+it|open\s+it|run\s+it|preview\s+it|open\s+project|start\s+project|chala\s+do|open\s+kardo|kholo\s+ise)\b/i.test(lower)) {
      const activeProj = useVoiceStore.getState().activeProject;
      if (activeProj) {
        console.log(`[ActionEngine] ⚡ Instant Fast Path: Opening Active Project "${activeProj.name}"`);
        const toolRes = await executeTool('project_mcp_run_and_open_web', {
          project_dir: activeProj.dir,
          port: activeProj.port || 5180
        });
        if (toolRes.success) {
          return isHindi 
            ? this.pickRandom([
                `Sure Sir Mayank, main abhi ${activeProj.name} ko browser mein open kar rahi hoon.`,
                `Ji Sir, ${activeProj.name} aapke browser mein launch kar diya hai.`,
                `Bilkul, ${activeProj.name} live ho gaya hai.`
              ])
            : this.pickRandom([
                `Opening ${activeProj.name} in your browser now, Sir.`,
                `Launching ${activeProj.name} preview right away.`,
                `${activeProj.name} is now running and opened for you, Sir Mayank.`
              ]);
        }
      }
    }

    // ─── 1. App Launch / Close (dynamic /Applications scan + fuzzy match) ───
    const hasOpenVerb = /\b(?:open|launch|kholo|start|chalao|run|show|display|dikhao)\b/i.test(lower);
    const hasCloseVerb = /\b(?:close|quit|kill|band|hatao|exit)\b/i.test(lower);

    if ((hasOpenVerb || hasCloseVerb) && !(/\b(?:music|song|gaana|gana|track|settings|setting|preferences|project)\b/i.test(lower))) {
      // Extract what the user called the app
      const spokenApp = lower
        .replace(/\b(?:open|launch|kholo|start|chalao|run|show|display|dikhao|close|quit|kill|band|hatao|exit|the|a|an|please|can you|pihu|abhi|karo|karna|kar do|kardo|for me|mere liye|application|browser)\b/gi, '')
        .replace(/\bapp\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (spokenApp && spokenApp.length >= 2) {
        const resolved = await ActionEngine.resolveAppName(spokenApp);

        if (resolved) {
          const { macName, displayName } = resolved;

          if (hasOpenVerb && !hasCloseVerb) {
            console.log(`[ActionEngine] ⚡ Fast App Launch: "${macName}" (display: ${displayName}, spoken: "${spokenApp}")`);
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              const cmd = macName === 'Finder'
                ? `osascript -e 'tell application "Finder" to activate'`
                : `open -a "${macName}"`;
              await invoke('execute_shell_command', { command: cmd });
              return isHindi
                ? this.pickRandom([
                    `Sure Sir Mayank, ${displayName} open kar diya hai.`,
                    `Ji Sir, ${displayName} launch ho gaya hai.`,
                    `Bilkul, ${displayName} khol diya hai Sir.`,
                    `Done Sir, ${displayName} open ho gaya hai.`,
                    `${displayName} aapke screen par aa gaya hai, Sir.`
                  ])
                : this.pickRandom([
                    `Opening ${displayName} for you now, Sir.`,
                    `Launching ${displayName} right away, Sir Mayank.`,
                    `Sure, ${displayName} is opened.`,
                    `${displayName} is ready on your screen, Sir.`,
                    `Got it, ${displayName} is open.`,
                    `Done, launched ${displayName} for you.`
                  ]);
            } catch (err: any) {
              const errMsg = String(err?.message || err || '');
              console.warn(`[ActionEngine] ⚠️ Failed to open "${macName}":`, errMsg);
              if (errMsg.includes('Unable to find') || errMsg.includes('not found') || errMsg.includes('does not exist')) {
                return isHindi
                  ? `Sir, "${displayName}" nahi mil raha system mein. Shayad yeh install nahi hai.`
                  : `Sorry Sir, I couldn't find "${displayName}" on your system. It may not be installed.`;
              }
              return isHindi
                ? `Sir, "${displayName}" open karne mein error aaya: ${errMsg.slice(0, 100)}`
                : `Couldn't open ${displayName}, Sir. Error: ${errMsg.slice(0, 100)}`;
            }
          }

          if (hasCloseVerb) {
            console.log(`[ActionEngine] ⚡ Fast App Close: "${macName}" (display: ${displayName})`);
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              await invoke('execute_shell_command', { command: `osascript -e 'quit app "${macName}"'` });
              return isHindi
                ? this.pickRandom([
                    `Ji Sir, ${displayName} band kar diya hai.`,
                    `${displayName} close ho gaya hai, Sir.`,
                    `Bilkul, ${displayName} close kar diya gaya hai.`
                  ])
                : this.pickRandom([
                    `Closed ${displayName} for you, Sir.`,
                    `Quitting ${displayName} now.`,
                    `Sure, ${displayName} has been closed.`,
                    `${displayName} is now closed, Sir Mayank.`
                  ]);
            } catch (err: any) {
              const errMsg = String(err?.message || err || '');
              console.warn(`[ActionEngine] ⚠️ Failed to close "${macName}":`, errMsg);
              return isHindi
                ? `Sir, "${displayName}" close karne mein issue aaya: ${errMsg.slice(0, 100)}`
                : `Couldn't close ${displayName}, Sir. ${errMsg.slice(0, 100)}`;
            }
          }
        } else {
          // No match found at all
          if (hasOpenVerb) {
            return isHindi
              ? `Sir, "${spokenApp}" naam ki koi app nahi mili system mein. Shayad yeh install nahi hai.`
              : `Sorry Sir, I couldn't find any app matching "${spokenApp}" on your system.`;
          }
        }
      }
    }

    // ─── 3. Settings Window Navigation ───
    if (/\b(?:settings|setting|preferences)\b/i.test(lower) && /\b(?:open|show|kholo|view|dikhao|display)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Opening Settings Window`);
      await executeTool('system_open_settings', { section: 'general' });
      return isHindi
        ? this.pickRandom([
            "Sure Sir Mayank, main Settings open kar rahi hoon.",
            "Ji Sir, Settings open kar di hai.",
            "Settings window aapke screen par khol di gayi hai."
          ])
        : this.pickRandom([
            "Opening Settings for you right now, Sir.",
            "Launching Settings window, Sir Mayank.",
            "Sure, Settings is open."
          ]);
    }

    // ─── 4. Music Playback Controls ───
    if (/\b(?:pause|stop|ruk|roko|band\s*karo)\b/i.test(lower) && /\b(?:music|song|gaana|gana|track)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Pausing Music`);
      const { useMusicStore } = await import('../../../stores/musicStore');
      useMusicStore.getState().setIsPlaying(false);
      return isHindi
        ? this.pickRandom([
            "Music pause kar diya gaya hai, Sir.",
            "Ji, gaana rok diya hai.",
            "Bilkul, music band kar diya hai."
          ])
        : this.pickRandom([
            "Paused music playback, Sir.",
            "Music is paused.",
            "Stopping music playback for you now, Sir Mayank."
          ]);
    }

    if (/\b(?:play|resume|chalao|bajao|start)\b/i.test(lower) && /\b(?:music|song|gaana|gana|track)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Playing Music`);
      const { useMusicStore } = await import('../../../stores/musicStore');
      useMusicStore.getState().setIsPlaying(true);
      return isHindi
        ? this.pickRandom([
            "Music play ho raha hai, Sir.",
            "Ji, gaana shuru kar diya hai.",
            "Bilkul, music resume kar diya gaya hai."
          ])
        : this.pickRandom([
            "Resuming music playback, Sir.",
            "Playing your music now, Sir Mayank.",
            "Music is playing."
          ]);
    }

    // ─── 5. Volume Controls ───
    if (/\b(?:mute|chup|silent|shant)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Muting System`);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('execute_shell_command', { command: 'osascript -e "set volume output muted true"' });
        return isHindi
          ? this.pickRandom([
              "Volume mute kar diya gaya hai, Sir.",
              "Ji, system mute ho gaya hai.",
              "Audio mute kar diya hai."
            ])
          : this.pickRandom([
              "System volume muted, Sir.",
              "Muted the audio for you.",
              "Volume is now muted, Sir Mayank."
            ]);
      } catch {}
    }

    if (/\b(?:unmute)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Unmuting System`);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('execute_shell_command', { command: 'osascript -e "set volume output muted false"' });
        return isHindi
          ? this.pickRandom([
              "Volume unmute kar diya gaya hai, Sir.",
              "Ji, sound wapas on kar diya hai.",
              "System unmute ho gaya hai."
            ])
          : this.pickRandom([
              "System volume unmuted, Sir.",
              "Audio is back on.",
              "Unmuted the sound for you, Sir Mayank."
            ]);
      } catch {}
    }

    if (/\b(?:volume\s+up|increase\s+volume|turn\s+up\s+volume|volume\s+badhao|aawaz\s+badhao)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Increasing Volume`);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('execute_shell_command', { command: 'osascript -e "set volume output volume ((output volume of (get volume settings)) + 15)"' });
        return isHindi ? "Volume badha diya hai, Sir." : "Turned up the volume for you, Sir.";
      } catch {}
    }

    if (/\b(?:volume\s+down|decrease\s+volume|turn\s+down\s+volume|volume\s+kam|aawaz\s+kam)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Decreasing Volume`);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('execute_shell_command', { command: 'osascript -e "set volume output volume ((output volume of (get volume settings)) - 15)"' });
        return isHindi ? "Volume kam kar diya gaya hai, Sir." : "Turned down the volume for you, Sir.";
      } catch {}
    }

    // ─── 6. Time and Date Query ───
    if (/\b(?:time|samay|waqt)\b/i.test(lower) && /\b(?:what|kya|batao|tell|kitna)\b/i.test(lower)) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return isHindi
        ? this.pickRandom([
            `Abhi time ${timeStr} ho raha hai, Sir.`,
            `Is waqt ${timeStr} baje hain, Sir Mayank.`,
            `Sir, abhi ${timeStr} ho rahe hain.`
          ])
        : this.pickRandom([
            `It is currently ${timeStr}, Sir.`,
            `The time is ${timeStr}, Sir Mayank.`,
            `Right now it's ${timeStr}.`
          ]);
    }

    if (/\b(?:date|tarikh|tareekh|din|day)\b/i.test(lower) && /\b(?:today|aaj|what|kya|batao)\b/i.test(lower)) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return isHindi
        ? this.pickRandom([
            `Aaj ${dateStr} hai, Sir.`,
            `Sir Mayank, aaj ${dateStr} hai.`
          ])
        : this.pickRandom([
            `Today is ${dateStr}, Sir.`,
            `It's ${dateStr} today, Sir Mayank.`
          ]);
    }

    // ─── 7. Battery & System Stats Query ───
    if (/\b(?:battery|charging|charge)\b/i.test(lower) && /\b(?:status|percentage|kitni|kya|level|how)\b/i.test(lower)) {
      const stats = getGlobalSystemStats();
      if (stats?.battery) {
        const pct = Math.round(stats.battery.percentage);
        const state = stats.battery.state;
        return isHindi
          ? `Battery abhi ${pct}% par hai (${state}), Sir.`
          : `Your battery is currently at ${pct}% (${state}), Sir Mayank.`;
      }
    }

    return null;
  }

  public async processIntent(text: string): Promise<string> {
    try {
      // Step 1: Pre-LLM Normalization (STT -> Normalizer)
      const cleanText = this.normalizePreLLM(text);
      if (!cleanText || cleanText === '[BLANK_AUDIO]') {
        return "";
      }

      console.log('[ActionEngine] Processing intent:', cleanText);

      // Step 2: Instant Fast Path for Direct System Activities & Commands
      const fastResponse = await this.tryFastDirectIntent(cleanText);
      if (fastResponse) {
        console.log('[ActionEngine] Fast direct response:', fastResponse);
        this.conversationHistory.push({ role: 'user', parts: [{ text: cleanText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: fastResponse }] });
        return fastResponse;
      }

      // Resolve a pending fuzzy WhatsApp recipient before starting a new LLM turn.
      const pendingConfirmation = await handlePendingWhatsAppConfirmation(cleanText);
      if (pendingConfirmation) {
        this.conversationHistory.push({ role: 'user', parts: [{ text: cleanText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: pendingConfirmation }] });
        return pendingConfirmation;
      }

      useVoiceStore.getState().setProcessingStatus("Thinking...");

      const fullSystemInstruction = PIHU_CORE_IDENTITY + this.getDynamicContext();

      // Keep last 10 turns of conversation history in memory for continuous conversation context
      const historyToPass = this.conversationHistory.slice(-10);

      // Step 3: LLM Generation with 8-second Timeout Guard to prevent UI lockup
      const llmPromise = this.llm.generateWithTools(
        {
          prompt: cleanText,
          systemInstruction: fullSystemInstruction,
          history: historyToPass,
          tools: buildGeminiTools()
        },
        executeTool
      );

      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('LLM response timed out')), 8000)
      );

      const rawResponse = await Promise.race([llmPromise, timeoutPromise]);

      // Step 4: Post-LLM Normalization (LLM -> LLM Normalizer -> TTS)
      const response = this.normalizePostLLM(rawResponse);

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
      return `Main aapki request process kar rahi hoon.`;
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  Dynamic App Discovery — scans /Applications at runtime + fuzzy match
  // ═══════════════════════════════════════════════════════════════════════════

  /** Cached list of installed app bundle names (without .app extension). */
  private static installedApps: string[] = [];
  private static appsCacheTime: number = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

  /** Nicknames: common spoken shorthand → exact macOS bundle name */
  private static readonly APP_NICKNAMES: Record<string, string> = {
    'chrome': 'Google Chrome',
    'google chrome': 'Google Chrome',
    'brave': 'Brave Browser',
    'vs code': 'Visual Studio Code',
    'vscode': 'Visual Studio Code',
    'code': 'Visual Studio Code',
    'iterm': 'iTerm',
    'iterm2': 'iTerm',
    'apple music': 'Music',
    'music app': 'Music',
    'calc': 'Calculator',
    'task manager': 'Activity Monitor',
    'docker': 'Docker Desktop',
    'explorer': 'Finder',
    'zoom': 'zoom.us',
    'teams': 'Microsoft Teams',
  };

  /** Scan /Applications, /System/Applications, ~/Applications and cache the list. */
  private static async refreshInstalledApps(): Promise<void> {
    if (ActionEngine.installedApps.length > 0 && Date.now() - ActionEngine.appsCacheTime < ActionEngine.CACHE_TTL_MS) {
      return; // Cache still valid
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw: string = await invoke('execute_shell_command', {
        command: 'ls -1 /Applications /System/Applications ~/Applications 2>/dev/null | grep "\\.app$" | sort -u'
      });
      const apps = raw
        .split('\n')
        .map(line => line.trim().replace(/\.app$/, ''))
        .filter(name => name.length > 0);

      ActionEngine.installedApps = apps;
      ActionEngine.appsCacheTime = Date.now();
      console.log(`[ActionEngine] 📦 Discovered ${apps.length} installed apps`);
    } catch (err) {
      console.warn('[ActionEngine] Failed to scan /Applications:', err);
    }
  }

  /** Levenshtein edit distance. */
  private static editDistance(a: string, b: string): number {
    const m = a.length, n = b.length;
    const row = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= n; j++) {
        const saved = row[j];
        row[j] = Math.min(
          row[j] + 1,          // deletion
          row[j - 1] + 1,      // insertion
          prev + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
        );
        prev = saved;
      }
    }
    return row[n];
  }

  /** Fuzzy score: 1.0 = exact, 0 = no match. Combines exact/substring/edit-distance. */
  private static fuzzyScore(query: string, candidate: string): number {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    const c = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!q || !c) return 0;
    if (q === c) return 1.0;
    if (c.startsWith(q)) return 0.95;
    if (c.includes(q) || q.includes(c)) return 0.85;
    const dist = ActionEngine.editDistance(q, c);
    const maxLen = Math.max(q.length, c.length);
    const similarity = 1 - dist / maxLen;
    return similarity;
  }

  /**
   * Resolve a spoken app name to the actual macOS bundle name.
   * 1. Check nicknames (chrome → Google Chrome)
   * 2. Scan installed apps from /Applications
   * 3. Fuzzy match against all installed apps
   */
  public static async resolveAppName(spoken: string): Promise<{ macName: string; displayName: string } | null> {
    const spokenLower = spoken.toLowerCase().trim();

    // 1. Check nickname map first (instant)
    const sortedNicknames = Object.keys(ActionEngine.APP_NICKNAMES).sort((a, b) => b.length - a.length);
    for (const nick of sortedNicknames) {
      if (spokenLower === nick || spokenLower.includes(nick)) {
        const macName = ActionEngine.APP_NICKNAMES[nick];
        return { macName, displayName: macName };
      }
    }

    // 2. Refresh installed apps cache
    await ActionEngine.refreshInstalledApps();

    if (ActionEngine.installedApps.length === 0) {
      // Fallback: just try title-cased spoken name
      return { macName: spoken.replace(/\b\w/g, c => c.toUpperCase()), displayName: spoken.replace(/\b\w/g, c => c.toUpperCase()) };
    }

    // 3. Fuzzy match against installed apps
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const app of ActionEngine.installedApps) {
      const score = ActionEngine.fuzzyScore(spokenLower, app);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = app;
      }
    }

    console.log(`[ActionEngine] 🔍 Fuzzy match: "${spokenLower}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);

    // Require reasonable confidence
    if (bestMatch && bestScore >= 0.55) {
      return { macName: bestMatch, displayName: bestMatch };
    }

    return null;
  }
}
