import { parseSpiritCommand } from '../../../features/spirits/voiceControl';
import { controlSpirit } from './tools/spiritTools';
import { messageNotifications } from '../../services/messageNotifications';
import { LLMManager } from '../../llm/LLMManager';
import { PIHU_CORE_IDENTITY } from './systemPrompt';
import { buildGeminiTools, executeTool as defaultExecuteTool } from './tools/index';
import { useAgentActivityStore } from '../../agent/activityStore';
import { handlePendingWhatsAppConfirmation } from './tools/whatsappTools';
import { handlePendingProjectConfirmation } from './tools/projectTools';
import { handlePendingEmailConfirmation } from './tools/googleWorkspaceTools';
import { useLayoutStore } from '../../layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useMemplaceStore } from '../../memory/MemplaceStore';
import { getGlobalSystemStats } from '../../../widgets/system/useSystemMonitor';
import type { GeminiContent } from '../../llm/types';
import { planSequence, runSequence } from '../../automation/sequenceIntent';
import { parseBrowserIntent } from '../../automation/browserIntent';
import { parseUIIntent } from '../../automation/uiIntent';
import { normalizeCommand } from '../../automation/normalizeCommand';
import { parseAppIntent } from '../../automation/appIntent';

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

  private async tryFastDirectIntent(text: string, executeTool = defaultExecuteTool): Promise<string | null> {
    const lower = text.toLowerCase().trim();
    const vtop = normalizeCommand(lower).match(/^(?:(set up|setup|configure)|(open|login to|log in to)|(continue|resume|finish))\s+vtop$/);
    if (vtop) {
      const result = await executeTool('vtop_login', {action:vtop[1]?'setup':vtop[2]?'open':'continue'});
      return result.success ? result.data.message : `VTOP: ${result.error}`;
    }
    const isHindi = /[\u0900-\u097F]/.test(text) || /\b(kya|tum|kr|karo|karti|karta|ho|hoon|kholo|chalao|band|badhao|kam|bhejo|sunao|abhi|kardo|kar do|dikhao|batao|bataiye|rok|roko|gaana|gana|waqt|samay|aaj)\b/i.test(lower);

    const browserIntent = navigator.platform.toUpperCase().includes('MAC') ? parseBrowserIntent(text) : null;
    if (browserIntent) {
      const result = await executeTool('macos_control_browser', browserIntent);
      return result.success ? result.data.message : `Browser action failed: ${result.error}`;
    }
    const uiIntent = navigator.platform.toUpperCase().includes('MAC') ? parseUIIntent(text) : null;
    if (uiIntent) {
      const result = await executeTool('macos_control_ui', uiIntent);
      return result.success ? result.data.message : `UI action failed: ${result.error}`;
    }

    // ─── 0. Contextual Project Actions ("then open it", "run it", "preview it") ───
    if (/\b(?:then\s+open\s+it|(?:open|run|start|preview)\s+(?:this|current|the current|my)?\s*project|open\s+it|run\s+it|preview\s+it|open\s+project|start\s+project|chala\s+do|open\s+kardo|kholo\s+ise)\b/i.test(lower)) {
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
        return `Could not open ${activeProj.name}: ${toolRes.error || "Development server failed to start."}`;
      }
      return "Select an active project before running its browser preview.";
    }

    // ─── 1. Gmail & Email Fast Paths ───
    // A. Check / Show Unread Emails
    if (/\b(?:unread\s+emails?|unread\s+mails?|check\s+(?:my\s+)?emails?|check\s+(?:my\s+)?inbox|check\s+(?:my\s+)?gmail|show\s+(?:me\s+)?unread\s+emails?|show\s+(?:my\s+)?emails?|show\s+(?:me\s+)?mails?|any\s+new\s+emails?|unread\s+messages?\s+in\s+gmail)\b/i.test(lower)) {
      console.log('[ActionEngine] ⚡ Instant Fast Path: Checking Unread Emails');
      useVoiceStore.getState().setProcessingStatus("Checking Gmail inbox...");
      const toolRes = await executeTool('google_workspace_notify_new_emails', {});
      useVoiceStore.getState().setProcessingStatus(null);
      if (toolRes.success && toolRes.data?.message) {
        return toolRes.data.message;
      }
      return isHindi ? "Gmail inbox check kar liya gaya hai." : "Checked your Gmail inbox, Sir.";
    }

    // B. Send Email Fast Path (Stage preview card)
    const emailSendMatch = lower.match(/\b(?:send\s+(?:an?\s+)?(?:email|mail)\s+to)\s+([a-zA-Z0-9\s@.]+?)\s+(?:that|saying|about|with\s+subject)\s+(.+)$/i);
    if (emailSendMatch) {
      const rawRecipient = emailSendMatch[1].trim();
      const rawContent = emailSendMatch[2].trim();
      const subject = rawContent.length > 35 ? (rawContent.slice(0, 35) + '...') : (rawContent.charAt(0).toUpperCase() + rawContent.slice(1));
      const body = `Dear ${rawRecipient},\n\n${rawContent.charAt(0).toUpperCase() + rawContent.slice(1)}.\n\nBest regards,\nMayank Jha`;

      console.log(`[ActionEngine] ⚡ Instant Fast Path: Staging Email to "${rawRecipient}"`);
      useVoiceStore.getState().setProcessingStatus(`Drafting email to ${rawRecipient}...`);
      const toolRes = await executeTool('google_workspace_send_email', {
        recipient: rawRecipient,
        subject: `Update regarding: ${subject}`,
        body: body
      });
      useVoiceStore.getState().setProcessingStatus(null);
      if (toolRes.success && toolRes.data?.message) {
        return toolRes.data.message;
      }
    }

    // ─── 2. WhatsApp Fast Paths ───
    // A. Send WhatsApp Message Fast Path
    const waSendMatch = lower.match(/\b(?:send\s+(?:a\s+)?whatsapp(?:\s+message)?\s+to|send\s+message\s+to|text)\s+([a-zA-Z0-9\s+]+?)\s+(?:saying|that|with\s+text|message)?\s*[:"']?([^"']+)["']?$/i);
    if (waSendMatch && !/\b(?:email|mail|gmail)\b/i.test(lower)) {
      const rawRecipient = waSendMatch[1].replace(/\b(?:on\s+whatsapp|via\s+whatsapp|whatsapp)\b/gi, '').trim();
      let rawMsg = waSendMatch[2].replace(/^["':\s]+|["'\s]+$/g, '').trim();
      if (rawRecipient && rawMsg) {
        console.log(`[ActionEngine] ⚡ Instant Fast Path: Sending WhatsApp message to "${rawRecipient}": "${rawMsg}"`);
        useVoiceStore.getState().setProcessingStatus(`Sending WhatsApp to ${rawRecipient}...`);
        const toolRes = await executeTool('whatsapp_send_message', {
          recipient: rawRecipient,
          message: rawMsg
        });
        useVoiceStore.getState().setProcessingStatus(null);
        if (toolRes.success && toolRes.data?.message) {
          return toolRes.data.message;
        }
        if (toolRes.error) {
          return toolRes.error;
        }
      }
    }

    // B. Show Recent WhatsApp Messages
    if (/\b(?:recent\s+whatsapp|whatsapp\s+messages?|whatsapp\s+chats?|show\s+whatsapp\s+messages?|show\s+recent\s+whatsapp\s+messages?)\b/i.test(lower)) {
      console.log('[ActionEngine] ⚡ Instant Fast Path: Reading Recent WhatsApp Messages');
      useVoiceStore.getState().setProcessingStatus("Checking recent WhatsApp messages...");
      const toolRes = await executeTool('whatsapp_read_messages', { count: 5 });
      useVoiceStore.getState().setProcessingStatus(null);
      if (toolRes.success && toolRes.data?.message) {
        return toolRes.data.message;
      }
      return isHindi ? "WhatsApp messages check kar liye gaye hain." : "Checked your recent WhatsApp messages, Sir.";
    }

    // Native app/window control uses the existing Python automation's shared AppleScript.
    const appIntent = navigator.platform.toUpperCase().includes('MAC') ? parseAppIntent(text) : null;
    if (appIntent) {
      const result = await executeTool('macos_control_app', appIntent);
      if (result.success) return result.data.message;
      // Unknown open targets may be files or projects, so leave them to the LLM.
      if (appIntent.action !== 'open' || !String(result.error).includes('No unambiguous installed app')) {
        return `App action failed: ${result.error}`;
      }
    }

    // ─── 3. Desktop Windows & Widgets Voice Controls ───

    // Code Output Console Window (Open / Close / Clear)
    if (/\b(?:output\s+window|code\s+output|terminal\s+output|output\s+console|program\s+output|console\s+output)\b/i.test(lower) || 
        (/\b(?:output)\b/i.test(lower) && /\b(?:open|show|kholo|dikhao|display|close|band|hatao|hide|clear|saaf)\b/i.test(lower))) {
      const { useCodeOutputStore } = await import('../../../stores/codeOutputStore');
      
      if (/\b(?:close|hide|band|hatao|dismiss)\b/i.test(lower)) {
        console.log(`[ActionEngine] ⚡ Instant Fast Path: Closing Output Window`);
        useCodeOutputStore.getState().setIsOpen(false);
        return isHindi ? "Output window band kar di gayi hai, Sir." : "Closed the Code Output Console for you, Sir.";
      }

      if (/\b(?:clear|saaf|flush|clean)\b/i.test(lower)) {
        console.log(`[ActionEngine] ⚡ Instant Fast Path: Clearing Output Window`);
        useCodeOutputStore.getState().clearHistory();
        return isHindi ? "Output console clear kar diya gaya hai, Sir." : "Cleared the code output console.";
      }

      console.log(`[ActionEngine] ⚡ Instant Fast Path: Opening Output Window`);
      useCodeOutputStore.getState().setIsOpen(true);
      return isHindi
        ? this.pickRandom([
            "Ji Sir Mayank, Code Output window open kar di hai.",
            "Output console aapke screen par aa gaya hai, Sir.",
            "Sure Sir, Code Output window open ho gaya hai."
          ])
        : this.pickRandom([
            "Opening Code Output Console for you now, Sir.",
            "Here is the program output console, Sir Mayank.",
            "Code Output window is open on your screen."
          ]);
    }

    // Tasks & Todo Window (Open / Close)
    if (/\b(?:task\s+window|tasks\s+window|task\s+manager|tasks|todos|todo\s+window|todo\s+list)\b/i.test(lower) &&
        /\b(?:open|show|kholo|view|dikhao|display|launch|close|band|hatao|hide)\b/i.test(lower)) {
      const layout = useLayoutStore.getState();
      const isClose = /\b(?:close|hide|band|hatao|dismiss)\b/i.test(lower);

      if (isClose) {
        console.log(`[ActionEngine] ⚡ Instant Fast Path: Closing Tasks Window`);
        if (layout.widgets['task-window']?.isOpen) layout.toggleWidget('task-window');
        return isHindi ? "Tasks window band kar di gayi hai, Sir." : "Closed the Tasks Manager, Sir.";
      }

      console.log(`[ActionEngine] ⚡ Instant Fast Path: Opening Tasks Window`);
      if (!layout.widgets['task-window']?.isOpen) layout.toggleWidget('task-window');
      return isHindi
        ? this.pickRandom([
            "Ji Sir Mayank, Tasks window open kar di hai.",
            "Aapke pending tasks screen par khol diye hain Sir.",
            "Tasks Manager open ho gaya hai, Sir."
          ])
        : this.pickRandom([
            "Opening your Tasks Manager now, Sir.",
            "Here are your tasks and todo list, Sir Mayank.",
            "Tasks window is now open on your desktop."
          ]);
    }

    // Settings Window (Open / Close)
    if (/\b(?:settings|setting|preferences|options)\b/i.test(lower) && 
        /\b(?:open|show|kholo|view|dikhao|display|close|band|hatao|hide)\b/i.test(lower)) {
      const layout = useLayoutStore.getState();
      const isClose = /\b(?:close|hide|band|hatao|dismiss)\b/i.test(lower);

      if (isClose) {
        console.log(`[ActionEngine] ⚡ Instant Fast Path: Closing Settings Window`);
        if (layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
        return isHindi ? "Settings window band kar di gayi hai, Sir." : "Closed Settings for you, Sir.";
      }

      let section = 'general';
      if (/\b(?:token|api\s*key|protocol|gemini\s*key|keys)\b/i.test(lower)) section = 'tokens';
      else if (/\b(?:connection|mcp|whatsapp|google|qr)\b/i.test(lower)) section = 'connections';
      else if (/\b(?:people|contact|contacts|directory)\b/i.test(lower)) section = 'people';
      else if (/\b(?:voice|speech|kokoro|tts)\b/i.test(lower)) section = 'voice';
      else if (/\b(?:diagnostics|health|system\s*check)\b/i.test(lower)) section = 'diagnostics';

      console.log(`[ActionEngine] ⚡ Instant Fast Path: Opening Settings (${section})`);
      await executeTool('system_open_settings', { section });
      return isHindi
        ? this.pickRandom([
            `Sure Sir Mayank, main Settings (${section}) open kar rahi hoon.`,
            `Ji Sir, Settings open kar di hai.`,
            `Settings window aapke screen par khol di gayi hai.`
          ])
        : this.pickRandom([
            `Opening Settings (${section}) for you right now, Sir.`,
            `Launching Settings window, Sir Mayank.`,
            `Sure, Settings is open.`
          ]);
    }

    // Widget Drawer (Open / Close)
    if (/\b(?:widget\s+drawer|widgets\s+drawer|widget\s+picker|widgets\s+menu)\b/i.test(lower) || 
        (/\b(?:widgets)\b/i.test(lower) && /\b(?:open|show|kholo|dikhao|add|close|band|hide)\b/i.test(lower))) {
      const isClose = /\b(?:close|hide|band|hatao|dismiss)\b/i.test(lower);
      const isDrawerOpen = useLayoutStore.getState().isWidgetDrawerOpen;

      if (isClose && isDrawerOpen) {
        useLayoutStore.getState().toggleWidgetDrawer();
        return isHindi ? "Widget drawer band kar diya hai, Sir." : "Closed the widget drawer.";
      }
      if (!isClose && !isDrawerOpen) {
        useLayoutStore.getState().toggleWidgetDrawer();
        return isHindi ? "Widget drawer open kar diya hai, Sir." : "Opening widget drawer for you, Sir.";
      }
    }

    // Command Palette (Open / Close / Toggle)
    if (/\b(?:command\s+palette|command\s+pallete|cmd\s+k|ctrl\s+k|command\s+bar|search\s+palette)\b/i.test(lower) ||
        (/\b(?:palette|pallete)\b/i.test(lower) && /\b(?:open|show|kholo|dikhao|close|band|hide)\b/i.test(lower))) {
      const isClose = /\b(?:close|hide|band|hatao|dismiss)\b/i.test(lower);
      const voiceStore = useVoiceStore.getState();
      if (isClose) {
        voiceStore.setIsCommandPaletteOpen(false);
        return isHindi ? "Command palette band kar diya hai, Sir." : "Closed the Command Palette.";
      } else {
        voiceStore.setIsCommandPaletteOpen(true);
        return isHindi ? "Command palette open kar diya hai, Sir. Aap yahan type kar sakte hain." : "Opened the Command Palette for you, Sir. You can type commands or select actions.";
      }
    }

    // Close All Windows / Clear Desktop
    if (/\b(?:close\s+all\s+windows|minimize\s+all|clear\s+screen|sab\s+band\s+kardo|close\s+everything|hide\s+all\s+windows)\b/i.test(lower)) {
      console.log(`[ActionEngine] ⚡ Instant Fast Path: Closing All Desktop Windows`);
      const layout = useLayoutStore.getState();
      const { useCodeOutputStore } = await import('../../../stores/codeOutputStore');

      // Close output window
      useCodeOutputStore.getState().setIsOpen(false);

      // Close drawer if open
      if (layout.isWidgetDrawerOpen) layout.toggleWidgetDrawer();

      // Close all active plugin windows (task-window, settings-window)
      ['task-window', 'settings-window'].forEach(id => {
        if (layout.widgets[id]?.isOpen) layout.toggleWidget(id);
      });

      return isHindi 
        ? "Desktop ke sabhi open windows band kar diye gaye hain, Sir." 
        : "Closed all active windows and cleared your desktop, Sir Mayank.";
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

  public async processIntent(text: string, onMode?: (mode: 'executing' | 'thinking') => void): Promise<string> {
    if (!text.trim()) return '';
    const activity = useAgentActivityStore.getState();
    const runId = activity.begin();
    let failed = false;
    try {
      return await this.processIntentInternal(text, mode => {
        activity.phase(runId, mode);
        onMode?.(mode);
      }, async (name, args) => {
        activity.phase(runId, 'executing');
        const result = await defaultExecuteTool(name, args);
        if (!result.success) failed = true;
        return result;
      }, () => { failed = true; });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      activity.finish(runId, failed);
    }
  }

  private async processIntentInternal(text: string, onMode: (mode: 'executing' | 'thinking') => void, executeTool: typeof defaultExecuteTool, onError: () => void): Promise<string> {
    try {
      // Step 1: Pre-LLM Normalization (STT -> Normalizer)
      const cleanText = this.normalizePreLLM(text);
      if (!cleanText || cleanText === '[BLANK_AUDIO]') {
        return "";
      }

      const spiritCommand = parseSpiritCommand(cleanText);
      if (spiritCommand) {
        onMode('executing');
        const result = controlSpirit(spiritCommand);
        return result.success ? result.data?.message || 'Updated Spirits.' : result.error || 'Could not update Spirits.';
      }
      const notificationReply = await messageNotifications.respond(cleanText);
      if (notificationReply) return notificationReply;

      console.log('[ActionEngine] Processing intent:', cleanText);

      // Step 2: Instant Fast Path for Direct System Activities & Commands
      const sequence = navigator.platform.toUpperCase().includes('MAC') ? planSequence(cleanText) : null;
      onMode?.('executing');
      const fastResponse = sequence && !sequence.error
        ? await runSequence(sequence, executeTool)
        : sequence?.error ? null : await this.tryFastDirectIntent(cleanText, executeTool);
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

      // Resolve a pending email draft confirmation before starting a new LLM turn.
      const pendingEmailConfirmation = await handlePendingEmailConfirmation(cleanText);
      if (pendingEmailConfirmation) {
        this.conversationHistory.push({ role: 'user', parts: [{ text: cleanText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: pendingEmailConfirmation }] });
        return pendingEmailConfirmation;
      }

      // Resolve a pending project / code modification confirmation before starting a new LLM turn.
      const pendingProjectConfirmation = await handlePendingProjectConfirmation(cleanText);
      if (pendingProjectConfirmation) {
        this.conversationHistory.push({ role: 'user', parts: [{ text: cleanText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: pendingProjectConfirmation }] });
        return pendingProjectConfirmation;
      }

      onMode?.('thinking');
      useVoiceStore.getState().setProcessingStatus("Thinking...");

      const fullSystemInstruction = PIHU_CORE_IDENTITY + this.getDynamicContext();

      // Keep last 10 turns of conversation history in memory for continuous conversation context
      const historyToPass = this.conversationHistory.slice(-10);

      // Step 3: LLM Generation with 25-second Timeout Guard to allow multi-step tool execution
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
        setTimeout(() => reject(new Error('LLM request timed out after 25s')), 25000)
      );

      const rawResponse = await Promise.race([llmPromise, timeoutPromise]);
      useVoiceStore.getState().setProcessingStatus(null);

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
      onError();
      useVoiceStore.getState().setProcessingStatus(null);
      const errMsg = error?.message || String(error);
      if (errMsg.includes('timed out')) {
        return `Sir, request process karne mein zyada samay lag gaya. Kripya punah koshish karein.`;
      }
      return `Sir, request process karne mein dikkat aayi: ${errMsg.slice(0, 120)}`;
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
      ActionEngine.installedApps = await invoke<string[]>('macos_list_apps');
      ActionEngine.appsCacheTime = Date.now();
      console.log(`[ActionEngine] 📦 Discovered ${ActionEngine.installedApps.length} installed apps`);
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
      if (spokenLower === nick) {
        const macName = ActionEngine.APP_NICKNAMES[nick];
        return { macName, displayName: macName };
      }
    }

    // 2. Refresh installed apps cache
    await ActionEngine.refreshInstalledApps();

    if (ActionEngine.installedApps.length === 0) return null;
    const exact = ActionEngine.installedApps.find(app => app.toLowerCase() === spokenLower);
    if (exact) return { macName: exact, displayName: exact };

    let bestMatch: string | null = null;
    let bestScore = 0;
    let runnerUp = 0;

    for (const app of ActionEngine.installedApps) {
      const score = ActionEngine.fuzzyScore(spokenLower, app);
      if (score > bestScore) {
        runnerUp = bestScore;
        bestScore = score;
        bestMatch = app;
      } else if (score > runnerUp) {
        runnerUp = score;
      }
    }

    console.log(`[ActionEngine] 🔍 Fuzzy match: "${spokenLower}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);

    // Require reasonable confidence
    if (bestMatch && bestScore >= 0.8 && bestScore - runnerUp > 0.03) {
      return { macName: bestMatch, displayName: bestMatch };
    }

    return null;
  }
}
