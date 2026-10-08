import { useVoiceStore } from '../../stores/voiceStore';
import { ensureWhatsAppBridge, WHATSAPP_API_URL } from '../../core/services/whatsappBridge';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { SpiritsSettings } from '../../features/spirits/SpiritsSettings';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import {
  Settings,
  Briefcase,
  LayoutGrid,
  Bell,
  Volume2,
  Mic,
  Key,
  Shield,
  Command,
  Info,
  X,
  Plus,
  Trash2,
  RotateCcw,
  Activity,
  Sparkles,
  Copy,
  Check,
  Cpu,
  FolderGit2,
  Search,
  ChevronRight,
  ArrowLeft,
  Wrench,
  Code,
  User,
  Users,
  RefreshCw,
  QrCode,
  MessageSquare,
  Phone,
  Mail,
  Edit2,
  CheckCircle2,
} from 'lucide-react';

interface McpToolDef {
  name: string;
  description: string;
  parameters: string[];
  category: string;
}

interface McpServerDef {
  id: string;
  name: string;
  desc: string;
  status: string;
  port: string;
  version: string;
  transport: string;
  tools: McpToolDef[];
}

export const SettingsWindow: React.FC = () => {
  const {
    geminiApiKeys,
    activeKeyIndex,
    exhaustedKeyIndices,
    addGeminiKey,
    removeGeminiKey,
    setActiveKeyIndex,
    resetExhaustedKeys,
    elevenLabsApiKey,
    elevenLabsVoiceId,
    setElevenLabsConfig,
    googleClientId,
    googleClientSecret,
    connectedGoogleAccounts,
    setGoogleWorkspaceConfig,
    removeConnectedGoogleAccount,
    setPrimaryGoogleAccount,
    themeAccent,
    setThemeAccent,
    blurIntensity,
    setBlurIntensity,
    dockVisible,
    setDockVisible,
    dockPosition,
    setDockPosition,
    dockMagnification,
    setDockMagnification,
    ttsSpeed,
    setTtsSpeed,
    activeSidebarCategory,
    setActiveSidebarCategory,
    contacts,
    addContact,
    setContacts,
    updateContact,
    removeContact,
  } = useSettingsStore();

  const [newKeyInput, setNewKeyInput] = useState('');
  const [copiedKeyIdx, setCopiedKeyIdx] = useState<number | null>(null);
  
  // MCP Inspector & In-Place Navigation states
  const [activeMcpDetailId, setActiveMcpDetailId] = useState<string | null>(null);
  const [mcpSearchQuery, setMcpSearchQuery] = useState('');
  const [copiedToolName, setCopiedToolName] = useState<string | null>(null);

  // General Page PIHU OS States
  const [userName, setUserName] = useState('Sir Mayank');
  const [workspacePath, setWorkspacePath] = useState('~/Documents/projects/pihu-os');
  const [autoStartBoot, setAutoStartBoot] = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);

  // WhatsApp Bridge & Device Pairing States
  const [waStatus, setWaStatus] = useState<{
    connected: boolean;
    logged_in: boolean;
    jid: string;
    os?: string;
    platform?: string;
    auth_state?: string;
  }>({ connected: false, logged_in: false, jid: '' });
  const [waQrCode, setWaQrCode] = useState<string>('');
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState('');
  const [waCopiedQr, setWaCopiedQr] = useState(false);

  // WhatsApp authentication belongs to the local bridge. The desktop, CLI and
  // REPL deliberately consume this same API/session instead of owning separate clients.
  const handleScanQr = async () => {
    setWaError('');
    setWaLoading(true);
    const safetyTimer = setTimeout(() => setWaLoading(false), 30000);
    try {
      await ensureWhatsAppBridge();
      await fetch(`${WHATSAPP_API_URL}/pair`, { method: 'POST', signal: AbortSignal.timeout(2000) }).catch(() => {});
      for (let i = 0; i < 12; i++) {
        try {
          const res = await fetch(`${WHATSAPP_API_URL}/pair`, { signal: AbortSignal.timeout(1500) });
          if (res.ok) {
            const d = await res.json();
            if (d.qr_code) {
              setWaQrCode(d.qr_code);
              break;
            }
            if (d.logged_in) {
              setWaStatus(prev => ({ ...prev, connected: true, logged_in: true, jid: d.jid || 'PIHU Desktop' }));
              setWaQrCode('');
              break;
            }
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (e) {
      setWaError(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(safetyTimer);
      setWaLoading(false);
    }
  };

  // WhatsApp Bridge live status & QR poller
  useEffect(() => {
    let isMounted = true;
    const fetchWaStatus = async () => {
      try {
        let isConnected = false;
        let isLoggedIn = false;

        // 1. Check status endpoint
        try {
          const res = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(1200) });
          if (res.ok) {
            const data = await res.json();
            if (typeof data.logged_in !== 'boolean' || typeof data.connected !== 'boolean') {
              throw new Error('Port 8080 is not serving the WhatsApp bridge.');
            }
            isConnected = true;
            if (isMounted) setWaError('');
            isLoggedIn = !!data.logged_in;
            if (isMounted) {
              setWaStatus({
                connected: !!data.connected,
                logged_in: !!data.logged_in,
                jid: data.jid || '',
                os: data.os || 'PIHU',
                platform: data.platform || 'PIHU Desktop',
                auth_state: data.auth_state,
              });
              if (data.logged_in) {
                setWaQrCode('');
              } else if (data.qr_code) {
                setWaQrCode(data.qr_code);
              }
            }
          }
        } catch (_) {}

        // 2. If bridge is active and not logged in, query /api/pair for active QR code
        if (isConnected && !isLoggedIn) {
          try {
            const pairRes = await fetch(`${WHATSAPP_API_URL}/pair`, { signal: AbortSignal.timeout(1500) });
            if (pairRes.ok) {
              const pairData = await pairRes.json();
              if (isMounted) {
                if (pairData.logged_in) {
                  setWaStatus(prev => ({ ...prev, logged_in: true, connected: true }));
                  setWaQrCode('');
                } else if (pairData.qr_code) {
                  setWaQrCode(pairData.qr_code);
                }
              }
            }
          } catch (_) {}
        }

        // 3. If bridge is offline
        if (!isConnected) {
          if (isMounted) {
            setWaStatus({ connected: false, logged_in: false, jid: '' });
          }
          // Auto-start bridge if user is actively in the Connections section
          if (activeSidebarCategory === 'connections') {
            ensureWhatsAppBridge().catch(error => {
              if (isMounted) setWaError(error instanceof Error ? error.message : String(error));
            });
          }
        }
      } catch (e) {
        if (isMounted) {
          setWaStatus({ connected: false, logged_in: false, jid: '' });
        }
      }
    };

    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSidebarCategory]);

  // People & Directory States
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactsHydrated, setContactsHydrated] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    notes: '',
  });

  // This is the directory shared by Tauri, CLI, REPL, and WhatsApp routing.
  // Hydrate before saving so Desktop never overwrites a contact just added via CLI.
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const raw = await invoke<string>('read_contacts');
        const loaded = JSON.parse(raw);
        if (Array.isArray(loaded)) setContacts(loaded);
      } catch (_) {
        // Keep the locally persisted directory available when Tauri is not ready.
      } finally {
        setContactsHydrated(true);
      }
    };
    loadContacts();
    window.addEventListener('focus', loadContacts);
    return () => window.removeEventListener('focus', loadContacts);
  }, [setContacts]);

  useEffect(() => {
    if (!contactsHydrated) return;
    const syncContacts = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_contacts', { contactsJson: JSON.stringify(contacts, null, 2) });
      } catch (_) {}
    };
    syncContacts();
  }, [contacts, contactsHydrated]);

  const messageVoiceAlerts = useSettingsStore(state => state.messageVoiceAlerts);
  // Notification states
  const [bannerAlerts, setBannerAlerts] = useState(true);
  const [spokenVoiceAlerts, setSpokenVoiceAlerts] = useState(true);
  const [soundChimes, setSoundChimes] = useState(true);
  const [doNotDisturb, setDoNotDisturb] = useState(false);

  // Master MCP Server & Tool Registry
  const mcpServers: McpServerDef[] = [
    {
      id: 'pihu-project-mcp',
      name: 'pihu-project-mcp',
      desc: 'Multi-language project scaffolding, runner, diagnosis, health, and server supervisor.',
      status: 'Active',
      port: 'stdio',
      version: '1.0.0',
      transport: 'JSON-RPC 2.0 (stdio)',
      tools: [
        {
          name: 'project_mcp_plan_project',
          description: 'Formulates comprehensive architecture plans covering target directories, framework tech stack, and module structure.',
          parameters: ['project_name', 'prompt', 'stack', 'styling', 'target_dir'],
          category: 'Architecture'
        },
        {
          name: 'project_mcp_create_react_project',
          description: 'Scaffolds a production-ready Vite + React + TypeScript + Tailwind + Framer Motion project with Lucide icons.',
          parameters: ['project_name', 'prompt', 'styling', 'target_dir'],
          category: 'Scaffolding'
        },
        {
          name: 'project_mcp_scaffold_project',
          description: 'Scaffolds multi-language stacks: Python (FastAPI, Django, Flask), Java (Spring Boot), Rust (Axum, Cargo), Go (Gin), C/C++, Lua.',
          parameters: ['project_name', 'language', 'stack', 'description', 'target_dir'],
          category: 'Scaffolding'
        },
        {
          name: 'project_mcp_run_and_open_web',
          description: 'Allocates non-reserved port (5180+), starts development server, validates health, and opens in user browser.',
          parameters: ['project_dir', 'preferred_port'],
          category: 'Runtime'
        },
        {
          name: 'project_mcp_diagnose_and_fix',
          description: 'Analyzes build & runtime error logs, automatically fixes missing dependencies, broken imports, and type errors.',
          parameters: ['project_dir', 'error_log', 'auto_fix'],
          category: 'Diagnostics'
        },
        {
          name: 'project_mcp_test_project',
          description: 'Executes stack-specific automated test suites (pytest, cargo test, go test, mvn test, ctest) and generates reports.',
          parameters: ['project_dir', 'test_framework'],
          category: 'Testing'
        },
        {
          name: 'project_mcp_manage_server',
          description: 'Lists, monitors, inspects logs, and terminates background server processes and daemon port allocations.',
          parameters: ['action', 'port', 'pid'],
          category: 'Server Supervisor'
        },
        {
          name: 'project_mcp_health_check',
          description: 'Verifies project health, toolchain binaries (cargo, node, python, go, cmake), and memory consumption.',
          parameters: ['project_dir'],
          category: 'Telemetry'
        },
      ]
    },
    {
      id: 'google-workspace-mcp',
      name: 'google-workspace-mcp',
      desc: 'Google Workspace orchestration across Gmail, Calendar, Docs, Tasks, Keep, and Google Drive.',
      status: 'Connected',
      port: '8080',
      version: '1.0.0',
      transport: 'OAuth 2.0 / REST API',
      tools: [
        {
          name: 'google_workspace_list_emails',
          description: 'Queries and fetches Gmail threads, unread messages, senders, and attachment metadata.',
          parameters: ['query', 'max_results', 'include_body'],
          category: 'Gmail'
        },
        {
          name: 'google_workspace_send_email',
          description: 'Composes and sends emails via authorized Gmail API with subject and HTML/plain text body.',
          parameters: ['to', 'subject', 'body', 'cc'],
          category: 'Gmail'
        },
        {
          name: 'google_workspace_list_calendar_events',
          description: 'Retrieves Google Calendar upcoming meetings, schedules, attendee RSVPs, and location details.',
          parameters: ['time_min', 'time_max', 'max_results'],
          category: 'Calendar'
        },
        {
          name: 'google_workspace_create_calendar_event',
          description: 'Creates new Google Calendar events with summary, description, start/end timestamps, and reminders.',
          parameters: ['summary', 'start_time', 'end_time', 'description', 'attendees'],
          category: 'Calendar'
        },
        {
          name: 'google_workspace_list_tasks',
          description: 'Fetches active task lists, pending todo items, and deadlines from Google Tasks.',
          parameters: ['task_list_id', 'show_completed'],
          category: 'Tasks'
        },
        {
          name: 'google_workspace_create_task',
          description: 'Adds new actionable items to Google Tasks with due dates and notes.',
          parameters: ['title', 'notes', 'due_date'],
          category: 'Tasks'
        },
        {
          name: 'google_workspace_list_drive_files',
          description: 'Searches, queries, and retrieves files, folders, and shared documents in Google Drive.',
          parameters: ['query', 'mime_type', 'max_results'],
          category: 'Drive'
        },
        {
          name: 'google_workspace_create_doc',
          description: 'Creates and edits Google Docs documents with formatted text and sections.',
          parameters: ['title', 'initial_content'],
          category: 'Docs'
        },
        {
          name: 'google_workspace_create_keep_note',
          description: 'Creates structured notes and checklists in Google Keep.',
          parameters: ['title', 'text', 'tags'],
          category: 'Keep'
        },
        {
          name: 'google_workspace_execute_cross_workflow',
          description: 'Executes automated multi-service flows (e.g. email meeting notes + create calendar event + add task).',
          parameters: ['workflow_type', 'parameters'],
          category: 'Orchestrator'
        },
      ]
    },
    {
      id: 'file-mcp',
      name: 'file-mcp',
      desc: 'Local filesystem deep indexer, semantic search, file creator, and atomic batch writer.',
      status: 'Active',
      port: 'in-proc',
      version: '1.0.0',
      transport: 'In-Process Native Bridge',
      tools: [
        {
          name: 'file_mcp_read_file',
          description: 'Reads local file contents with line range slicing and encoding detection.',
          parameters: ['path', 'offset', 'limit'],
          category: 'Read'
        },
        {
          name: 'file_mcp_write_file',
          description: 'Creates or modifies files on the local filesystem with automatic parent directory scaffolding.',
          parameters: ['path', 'content', 'overwrite'],
          category: 'Write'
        },
        {
          name: 'file_mcp_write_batch_files',
          description: 'Atomically writes multiple files across different directories in a single unified operation.',
          parameters: ['files'],
          category: 'Batch'
        },
        {
          name: 'file_mcp_search_files',
          description: 'Performs deep recursive searches across workspace by file pattern or text content.',
          parameters: ['query', 'directory', 'regex'],
          category: 'Search'
        },
        {
          name: 'file_mcp_open_folder',
          description: 'Reveals and opens specified directory paths directly in macOS Finder.',
          parameters: ['path'],
          category: 'System'
        },
        {
          name: 'file_mcp_open_file',
          description: 'Launches local files directly in system default applications or code editors.',
          parameters: ['path'],
          category: 'System'
        },
      ]
    },
    {
      id: 'system-mcp',
      name: 'system-mcp',
      desc: 'Host OS supervisor, application launcher, shell executor, and settings orchestrator.',
      status: 'Active',
      port: 'in-proc',
      version: '1.0.0',
      transport: 'In-Process Native Bridge',
      tools: [
        {
          name: 'system_open_application',
          description: 'Launches desktop applications on macOS (VS Code, Chrome, Brave, Spotify, Terminal, Finder).',
          parameters: ['app_name'],
          category: 'Apps'
        },
        {
          name: 'system_search_web_browser',
          description: 'Executes web searches directly in the user preferred web browser.',
          parameters: ['query', 'browser'],
          category: 'Browser'
        },
        {
          name: 'system_execute_command',
          description: 'Executes terminal shell commands and script executions with live stdout/stderr capture.',
          parameters: ['command', 'cwd'],
          category: 'Shell'
        },
        {
          name: 'system_get_running_servers',
          description: 'Lists all active background development servers and bound ports.',
          parameters: [],
          category: 'Telemetry'
        },
        {
          name: 'system_open_settings',
          description: 'Opens PIHU Settings Control Center and switches to the specified tab.',
          parameters: ['section'],
          category: 'Navigation'
        },
        {
          name: 'system_setup_workspace',
          description: 'Initializes and validates Python virtual environments and MCP runtime dependencies.',
          parameters: [],
          category: 'Setup'
        },
      ]
    },
    {
      id: 'memory-mcp',
      name: 'memory-mcp',
      desc: 'MemPalace persistent memory, user preferences, and session context recall.',
      status: 'Active',
      port: 'in-proc',
      version: '1.0.0',
      transport: 'In-Process Vector Store',
      tools: [
        {
          name: 'memplace_recall_projects',
          description: 'Recalls past user projects, architecture preferences, and recent milestones.',
          parameters: ['query', 'limit'],
          category: 'Memory'
        },
        {
          name: 'memplace_get_session_summary',
          description: 'Generates a concise summary of active session context and accomplished tasks.',
          parameters: [],
          category: 'Summary'
        },
        {
          name: 'memplace_check_health_guard',
          description: 'Checks continuous session duration and generates ergonomic wellness recommendations.',
          parameters: [],
          category: 'Health'
        },
      ]
    },
    {
      id: 'music-mcp',
      name: 'music-mcp',
      desc: 'YouTube Music streaming controller with OAuth library integration and queue management.',
      status: 'Active',
      port: '48123',
      version: '1.0.0',
      transport: 'HTTP / Python ytmusicapi',
      tools: [
        {
          name: 'music_play',
          description: 'Searches and streams tracks, playlists, or albums directly on YouTube Music.',
          parameters: ['query', 'artist'],
          category: 'Playback'
        },
        {
          name: 'music_pause',
          description: 'Pauses the currently playing track.',
          parameters: [],
          category: 'Playback'
        },
        {
          name: 'music_resume',
          description: 'Resumes audio playback.',
          parameters: [],
          category: 'Playback'
        },
        {
          name: 'music_next',
          description: 'Skips to the next track in the current playlist queue.',
          parameters: [],
          category: 'Playback'
        },
        {
          name: 'music_prev',
          description: 'Returns to the previous song in queue.',
          parameters: [],
          category: 'Playback'
        },
        {
          name: 'music_set_volume',
          description: 'Sets the playback volume level (0 to 100%).',
          parameters: ['volume'],
          category: 'Controls'
        },
      ]
    },
    {
      id: 'pihu-whatsapp-mcp',
      name: 'pihu-whatsapp-mcp',
      desc: 'WhatsApp Desktop Bridge: autonomous messaging, contact lookup, history sync, and audio messages.',
      status: 'Active',
      port: '8080',
      version: '1.0.0',
      transport: 'FastMCP (stdio) + Go Bridge',
      tools: [
        {
          name: 'whatsapp_send_message',
          description: 'Sends a WhatsApp text message to any phone number or group JID.',
          parameters: ['recipient', 'message'],
          category: 'Messaging'
        },
        {
          name: 'whatsapp_search_contacts',
          description: 'Searches WhatsApp contacts by name or phone number.',
          parameters: ['query'],
          category: 'Contacts'
        },
        {
          name: 'whatsapp_list_messages',
          description: 'Retrieves recent chat history with timestamp filters and context.',
          parameters: ['chat_jid', 'sender_phone_number', 'limit', 'query'],
          category: 'History'
        },
        {
          name: 'whatsapp_list_chats',
          description: 'Lists active WhatsApp conversations sorted by last activity.',
          parameters: ['query', 'limit', 'page'],
          category: 'Chats'
        },
        {
          name: 'whatsapp_get_chat',
          description: 'Retrieves specific chat metadata and recent interaction details.',
          parameters: ['chat_jid'],
          category: 'Chats'
        },
        {
          name: 'whatsapp_get_last_interaction',
          description: 'Fetches the most recent message with a specific contact.',
          parameters: ['jid'],
          category: 'Contacts'
        },
        {
          name: 'whatsapp_send_file',
          description: 'Sends an image, video, document, or audio file to a recipient.',
          parameters: ['recipient', 'media_path'],
          category: 'Media'
        },
        {
          name: 'whatsapp_send_audio_message',
          description: 'Sends voice notes or audio messages encoded with Opus format.',
          parameters: ['recipient', 'media_path'],
          category: 'Media'
        },
        {
          name: 'whatsapp_download_media',
          description: 'Downloads media attachments from a message to local disk.',
          parameters: ['message_id', 'chat_jid'],
          category: 'Media'
        },
      ]
    },
  ];

  const currentSelectedMcp = mcpServers.find(m => m.id === activeMcpDetailId);
  const filteredMcpTools = currentSelectedMcp ? currentSelectedMcp.tools.filter(t => 
    t.name.toLowerCase().includes(mcpSearchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(mcpSearchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(mcpSearchQuery.toLowerCase())
  ) : [];

  // Sync Google Workspace accounts from token file
  useEffect(() => {
    let isMounted = true;

    const syncAccountsFromFile = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const tokenPath = '~/.gemini/antigravity/google_workspace_tokens.json';
        const readCmd = `python3 -c "import os, json; p = os.path.expanduser('${tokenPath}'); print(open(p).read() if os.path.exists(p) else '{}')"`;
        const result = await invoke<string>('execute_shell_command', { command: readCmd });
        
        if (result && result.trim().startsWith('{')) {
          const data = JSON.parse(result);
          const parsedAccounts: any[] = [];

          if (data.accounts && Array.isArray(data.accounts)) {
            data.accounts.forEach((acc: any) => {
              if (acc.email) {
                parsedAccounts.push({
                  email: acc.email,
                  name: acc.name || acc.email.split('@')[0],
                  picture: acc.picture || '',
                  isPrimary: !!acc.is_primary,
                  connectedAt: acc.connected_at || new Date().toLocaleDateString('en-US'),
                });
              }
            });
          } else if (data.current_user && data.current_user.email) {
            parsedAccounts.push({
              email: data.current_user.email,
              name: data.current_user.name || data.current_user.email.split('@')[0],
              picture: data.current_user.picture || '',
              isPrimary: true,
              connectedAt: new Date().toLocaleDateString('en-US'),
            });
          }

          if (isMounted && parsedAccounts.length > 0) {
            useSettingsStore.setState({
              connectedGoogleAccounts: parsedAccounts,
              googleAccountConnected: true,
            });
          }
        }
      } catch (e) {
        // Ignore sync errors
      }
    };

    syncAccountsFromFile();
    const interval = setInterval(syncAccountsFromFile, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRemoveAccount = async (email: string) => {
    removeConnectedGoogleAccount(email);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const removeCmd = `python3 -c "import os, json; p = os.path.expanduser('~/.gemini/antigravity/google_workspace_tokens.json'); data = json.load(open(p)) if os.path.exists(p) else {}; data['accounts'] = [a for a in data.get('accounts', []) if a.get('email','').lower() != '${email.toLowerCase()}']; open(p, 'w').write(json.dumps(data, indent=2))"`;
      await invoke('execute_shell_command', { command: removeCmd });
    } catch (e) {}
  };

  const handleSetPrimary = async (email: string) => {
    setPrimaryGoogleAccount(email);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const primaryCmd = `python3 -c "import os, json; p = os.path.expanduser('~/.gemini/antigravity/google_workspace_tokens.json'); data = json.load(open(p)) if os.path.exists(p) else {}; data['accounts'] = [{**a, 'is_primary': a.get('email','').lower() == '${email.toLowerCase()}'} for a in data.get('accounts', [])]; open(p, 'w').write(json.dumps(data, indent=2))"`;
      await invoke('execute_shell_command', { command: primaryCmd });
    } catch (e) {}
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyInput.trim()) {
      addGeminiKey(newKeyInput.trim());
      setNewKeyInput('');
    }
  };

  const handleCopyKey = (key: string, idx: number) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyIdx(idx);
    setTimeout(() => setCopiedKeyIdx(null), 2000);
  };

  const handleCopyTool = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedToolName(name);
    setTimeout(() => setCopiedToolName(null), 2000);
  };

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const handleClose = () => {
    const layout = useLayoutStore.getState();
    if (layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented || useVoiceStore.getState().isCommandPaletteOpen) return;
      event.preventDefault();
      handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 10 Streamlined Sidebar Menu Items as requested
  const sidebarItems = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'connections', label: 'Connections', icon: Briefcase, badge: 'MCP' },
    { id: 'widgets', label: 'Widgets', icon: LayoutGrid },
    { id: 'spirits', label: 'Spirits', icon: Sparkles },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'voice', label: 'Voice & Speech', icon: Mic },
    { id: 'tokens', label: 'API & Tokens', icon: Key, badge: geminiApiKeys.length ? `${geminiApiKeys.length}` : undefined },
    { id: 'diagnostics', label: 'Engine Diagnostics', icon: Activity },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'shortcuts', label: 'Shortcuts', icon: Command },
    { id: 'people', label: 'People', icon: Users },
    { id: 'about', label: 'About PIHU', icon: Info },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4 sm:p-6 select-none animate-in fade-in duration-200">
      
      {/* Main Glass Window Frame */}
      <GlassCard blur="xl" frost="heavy" className="relative w-full max-w-5xl h-[min(760px,90vh)] rounded-3xl overflow-hidden flex text-white font-sans" style={{ backgroundColor: 'rgba(18,18,18,0.18)', backdropFilter: 'blur(40px) saturate(115%)', WebkitBackdropFilter: 'blur(40px) saturate(115%)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
        
        {/* Ambient Neon Glow Accents */}

        {/* ─── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <div className="w-64 min-w-64 border-r border-white/15 bg-white/[0.09] backdrop-blur-3xl flex flex-col p-4 z-10 shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)]">
          
          {/* macOS Traffic Lights Window Controls */}
          <div className="flex items-center gap-2 px-1 pt-1 pb-3">
            <button
              onClick={handleClose}
              title="Close"
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 active:brightness-90 transition flex items-center justify-center group shadow-sm"
            >
              <X className="w-2 h-2 text-black/70 opacity-0 group-hover:opacity-100 transition" />
            </button>
            <button
              onClick={handleClose}
              title="Minimize"
              className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:brightness-110 active:brightness-90 transition flex items-center justify-center group shadow-sm"
            >
              <div className="w-1.5 h-0.5 bg-black/70 opacity-0 group-hover:opacity-100 transition" />
            </button>
            <button
              title="Zoom"
              className="w-3 h-3 rounded-full bg-[#27c93f] hover:brightness-110 active:brightness-90 transition flex items-center justify-center group shadow-sm"
            >
              <div className="w-1.5 h-1.5 border-t border-r border-black/70 opacity-0 group-hover:opacity-100 transition" />
            </button>
          </div>

          {/* Logo & Workspace Title */}
          <div className="flex items-center gap-3 px-2 py-3 mb-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-2xl bg-white/10    flex items-center justify-center text-white shadow-lg shadow-neutral-500/30 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-white">PIHU OS</h2>
              <p className="text-[11px] text-neutral-400 font-medium">System Preferences</p>
            </div>
          </div>

          {/* Navigation Items List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSidebarCategory === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSidebarCategory(item.id);
                    if (item.id === 'connections') {
                      setActiveMcpDetailId(null);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition duration-150 ${
                    isActive
                      ? 'bg-white/10   border border-white/20 text-white shadow-sm font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-neutral-400' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-neutral-500/20 text-[10px] font-semibold text-neutral-400">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Footer Info */}
          <div className="pt-3 mt-auto border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500 px-2">
            <span>Developed by Mayank Jha</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-medium">Active</span>
            </div>
          </div>
        </div>


        {/* ─── RIGHT CONTENT AREA ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/[0.08] z-10 overflow-hidden">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-white/[0.01]">
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">
                {activeSidebarCategory === 'general' && 'PIHU OS System Profile'}
                {activeSidebarCategory === 'connections' && (activeMcpDetailId ? `${currentSelectedMcp?.name} • Tools Explorer` : 'Connections & MCP Servers')}
                {activeSidebarCategory === 'widgets' && 'Active Desktop Widgets'}
                {activeSidebarCategory === 'spirits' && 'Spirits'}
                {activeSidebarCategory === 'notifications' && 'Notification Preferences'}
                {activeSidebarCategory === 'voice' && 'Voice & Speech Engine'}
                {activeSidebarCategory === 'tokens' && 'API & Token Protocol'}
                {activeSidebarCategory === 'diagnostics' && 'Engine Health & Diagnostics'}
                {activeSidebarCategory === 'privacy' && 'Privacy & Security'}
                {activeSidebarCategory === 'shortcuts' && 'Keyboard Shortcuts'}
                {activeSidebarCategory === 'people' && 'People & Directory'}
                {activeSidebarCategory === 'about' && 'About PIHU OS'}
              </h1>
              <p className="text-xs text-neutral-400">
                {activeSidebarCategory === 'general' && 'Operating system profile, runtime context, memory cache, and assistant persona.'}
                {activeSidebarCategory === 'connections' && (activeMcpDetailId ? `Listing all ${currentSelectedMcp?.tools.length} executable tool declarations and parameters.` : 'Google Workspace OAuth, project MCP, file MCP, and external tool protocols.')}
                {activeSidebarCategory === 'widgets' && 'Toggle canvas widgets, dock magnification, and screen layout.'}
                {activeSidebarCategory === 'spirits' && 'Add animated companions to your desktop and make them your own.'}
                {activeSidebarCategory === 'notifications' && 'Control voice spoken alerts, desktop banners, and chime sounds.'}
                {activeSidebarCategory === 'voice' && 'Configure Kokoro Neural TTS, ElevenLabs voice models, and speech latency.'}
                {activeSidebarCategory === 'tokens' && 'Multi-key failover protocol for uninterrupted Gemini AI operations.'}
                {activeSidebarCategory === 'diagnostics' && 'Live real-time telemetry for voice servers, STT, and MCP tools.'}
                {activeSidebarCategory === 'privacy' && 'On-device local AI processing, encrypted keys, and data boundaries.'}
                {activeSidebarCategory === 'shortcuts' && 'Global hotkeys and quick action triggers across PIHU OS.'}
                {activeSidebarCategory === 'people' && 'Define contacts, email addresses, and phone numbers for AI messaging via Gmail and WhatsApp.'}
                {activeSidebarCategory === 'about' && 'System version, Tauri v2 core architectures, and credits.'}
              </p>
            </div>


          </div>

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

            {/* ══════ SECTION 1: GENERAL (PIHU OS Core Profile) ══════ */}
            {activeSidebarCategory === 'general' && (
              <div className="space-y-6">
                
                {/* OS Identity & Salutation */}
                <div className="p-5 rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10   flex items-center justify-center text-white shadow-lg shadow-neutral-500/20">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Assistant Persona & Greeting</h4>
                        <p className="text-[11px] text-neutral-400">PIHU addresses you with this salutation across voice interactions</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-neutral-500/20 text-neutral-400 text-xs font-bold">
                      Persona Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">User Title / Salutation</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="e.g. Sir Mayank"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Default Workspace Directory</label>
                      <input
                        type="text"
                        value={workspacePath}
                        onChange={(e) => setWorkspacePath(e.target.value)}
                        placeholder="~/Documents/projects/pihu-os"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Local AI Architecture Stack */}
                <div className="p-5 rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-neutral-400" /> PIHU OS Local AI Engines
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-black/[0.12] backdrop-blur-lg border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-semibold block">STT Engine</span>
                        <span className="text-xs font-bold text-neutral-200">Whisper.cpp GGML Base</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10">Local C++</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-black/[0.12] backdrop-blur-lg border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-semibold block">TTS Engine</span>
                        <span className="text-xs font-bold text-neutral-200">Kokoro Neural Synthesizer</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10">Port 48126</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-black/[0.12] backdrop-blur-lg border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-semibold block">WakeWord Listener</span>
                        <span className="text-xs font-bold text-neutral-200">OpenWakeWord + Silero VAD</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10">4 Models</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-black/[0.12] backdrop-blur-lg border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-semibold block">Web Project Port Allocator</span>
                        <span className="text-xs font-bold text-neutral-200">Port 5180+ Auto-Scanned</span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded-md bg-neutral-500/10">Reserved 5173</span>
                    </div>
                  </div>
                </div>

                {/* System Startup & Memory Cache Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white">Auto-Start on Boot</h4>
                      <p className="text-[11px] text-neutral-500">Launch PIHU OS daemon on login</p>
                    </div>
                    <button
                      onClick={() => setAutoStartBoot(!autoStartBoot)}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
                        autoStartBoot ? 'bg-white/10  ' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                          autoStartBoot ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="p-5 rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white">Memory & Cache</h4>
                      <p className="text-[11px] text-neutral-500">Active project context & index</p>
                    </div>
                    <button
                      onClick={handleClearCache}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-300 transition"
                    >
                      {cacheCleared ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Purged!</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Clear Cache</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Theme & Blur Controls */}
                <div className="p-5 rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Theme & Glass Accent</h4>
                      <p className="text-[11px] text-neutral-400">Customize system accent highlights and backdrop glass blur</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'pink', color: 'bg-white/10' },
                        { id: 'purple', color: 'bg-white/10' },
                        { id: 'cyan', color: 'bg-white/10' },
                        { id: 'emerald', color: 'bg-white/10' },
                        { id: 'amber', color: 'bg-white/10' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setThemeAccent(t.id as any)}
                          className={`px-2 h-7 text-[10px] capitalize rounded-lg ${t.color} flex items-center justify-center transition ring-offset-2 ring-offset-slate-950 ${
                            themeAccent === t.id ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          {t.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-neutral-300">
                      <span>Glassmorphism Blur</span>
                      <span className="font-mono text-neutral-400">{blurIntensity}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="48"
                      value={blurIntensity}
                      onChange={(e) => setBlurIntensity(Number(e.target.value))}
                      className="w-full accent-neutral-500 cursor-pointer"
                    />
                  </div>
                </div>

              </div>
            )}


            {/* ══════ SECTION 2: CONNECTIONS (In-Place MCP Tool Explorer) ══════ */}
            {activeSidebarCategory === 'connections' && (
              <div className="space-y-6">
                
                {/* IF A SPECIFIC MCP IS SELECTED: IN-PLACE DRILL-DOWN TOOL EXPLORER */}
                {activeMcpDetailId && currentSelectedMcp ? (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    
                    {/* Back Button & Server Header */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-white/10">
                      <button
                        onClick={() => setActiveMcpDetailId(null)}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-400 transition hover:scale-105"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to All MCP Servers
                      </button>

                      {/* Tool Search Input */}
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500" />
                        <input
                          type="text"
                          placeholder="Search tools in this server..."
                          value={mcpSearchQuery}
                          onChange={(e) => setMcpSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-medium"
                        />
                      </div>
                    </div>

                    {/* Active MCP Server Banner */}
                    <div className="p-4 rounded-2xl bg-white/10   border border-neutral-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-500/20 border border-neutral-500/40 flex items-center justify-center text-neutral-400 shadow-lg shadow-neutral-500/20">
                          <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white font-mono">{currentSelectedMcp.name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400">
                              {currentSelectedMcp.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-neutral-500/20 text-[9px] font-bold text-neutral-400">
                              {currentSelectedMcp.tools.length} Tools
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300 mt-0.5">{currentSelectedMcp.desc}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400 px-2.5 py-1 rounded-lg bg-black/[0.12] backdrop-blur-lg border border-white/5">
                        {currentSelectedMcp.transport}
                      </span>
                    </div>

                    {/* Scrollable List of Tools */}
                    <div className="space-y-3 pt-1">
                      {filteredMcpTools.length === 0 ? (
                        <div className="p-8 text-center text-xs text-neutral-500 bg-black/20 rounded-2xl border border-white/5">
                          No tools matched "{mcpSearchQuery}"
                        </div>
                      ) : (
                        filteredMcpTools.map((tool, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 hover:border-neutral-500/20 hover:bg-black/[0.12] backdrop-blur-lg transition group"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Code className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                  <span className="font-mono text-xs font-bold text-neutral-300 group-hover:text-neutral-400 transition">
                                    {tool.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-medium text-neutral-400">
                                    {tool.category}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                                  {tool.description}
                                </p>
                              </div>

                              <button
                                onClick={() => handleCopyTool(tool.name)}
                                title="Copy tool declaration name"
                                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-white/10 transition shrink-0"
                              >
                                {copiedToolName === tool.name ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            {/* Parameter Tags */}
                            {tool.parameters.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-white/5 text-[10px]">
                                <span className="text-neutral-500 font-medium">Args:</span>
                                {tool.parameters.map((p, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 font-mono text-neutral-400"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* TOP LEVEL MCP SERVER CARDS GRID */
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                          Model Context Protocol (MCP) Servers
                        </h3>
                        <span className="text-[11px] text-neutral-400 font-medium">Click any server to list tools</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {mcpServers.map((mcp) => (
                          <button
                            key={mcp.id}
                            onClick={() => {
                              setActiveMcpDetailId(mcp.id);
                              setMcpSearchQuery('');
                            }}
                            className="w-full text-left p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 hover:border-neutral-500/30 hover:bg-black/[0.12] backdrop-blur-lg transition duration-200 flex flex-col justify-between group shadow-lg"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white font-mono group-hover:text-neutral-300 transition">
                                  {mcp.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400">
                                  {mcp.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-neutral-500 px-2 py-0.5 rounded-lg bg-white/5">
                                  {mcp.port}
                                </span>
                                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-400 group-hover:translate-x-0.5 transition" />
                              </div>
                            </div>

                            <p className="text-[11px] text-neutral-400 mt-1.5 line-clamp-2">{mcp.desc}</p>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[10px] text-neutral-500 w-full">
                              <span className="text-neutral-400 font-medium">{mcp.tools.length} Executable Tools</span>
                              <span className="font-mono text-neutral-400">{mcp.transport}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Google Workspace OAuth Client Credentials */}
                    <div className="p-5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <FolderGit2 className="w-4 h-4 text-neutral-400" /> Google OAuth Credentials
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5">Desktop Application OAuth Client for Workspace automation</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Client ID</label>
                          <input
                            type="text"
                            placeholder="Google OAuth Client ID"
                            value={googleClientId}
                            onChange={(e) => setGoogleWorkspaceConfig(e.target.value, googleClientSecret, true)}
                            className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Client Secret</label>
                          <input
                            type="password"
                            placeholder="Google OAuth Client Secret"
                            value={googleClientSecret}
                            onChange={(e) => setGoogleWorkspaceConfig(googleClientId, e.target.value, true)}
                            className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Connected Google Accounts List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                          Connected Google Accounts ({connectedGoogleAccounts.length})
                        </h3>
                        <button
                          onClick={async () => {
                            const cId = googleClientId.trim();
                            const cSecret = googleClientSecret.trim();
                            if (!cId || !cSecret) {
                              alert('Please enter your Google OAuth Client ID and Client Secret above first!');
                              return;
                            }
                            const { invoke } = await import('@tauri-apps/api/core');
                            try {
                              await invoke('google_oauth_start', { clientId: cId, clientSecret: cSecret });
                            } catch (error) {
                              alert(`Google sign-in could not start: ${String(error)}`);
                            }
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10   hover: hover: text-white text-xs font-semibold shadow-lg shadow-neutral-500/20 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Link Another Account
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {connectedGoogleAccounts.map((account, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 hover:border-white/10 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-white/10   flex items-center justify-center text-xs font-bold text-white shadow">
                                {account.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-semibold text-white">{account.name}</h4>
                                  {account.isPrimary && (
                                    <span className="px-2 py-0.5 rounded-full bg-neutral-500/20 text-[9px] font-bold text-neutral-400">
                                      PRIMARY
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-400">{account.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!account.isPrimary && (
                                <button
                                  onClick={() => handleSetPrimary(account.email)}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-neutral-300 transition"
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveAccount(account.email)}
                                className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* WhatsApp MCP Device Pairing & QR Code Card */}
                    <div className="p-5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white">PIHU WhatsApp MCP</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                waStatus.logged_in
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {waStatus.logged_in ? '● Linked & Connected' : '○ Pairing Required'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Device: <span className="text-neutral-400 font-mono">PIHU Desktop</span> • Bridge: <span className="font-mono text-neutral-300">FastMCP + whatsmeow</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              if (confirm('Clear all local WhatsApp sessions, chats cache and database?')) {
                                try {
                                  await fetch(`${WHATSAPP_API_URL}/clear`, { method: 'POST' });
                                } catch (e) {}
                                setWaStatus({ connected: false, logged_in: false, jid: '' });
                                setWaQrCode('');
                              }
                            }}
                            title="Clear local WhatsApp session & message database"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-xs font-semibold text-neutral-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear Data
                          </button>

                          {waStatus.logged_in ? (
                            <button
                              onClick={async () => {
                                try {
                                  await fetch(`${WHATSAPP_API_URL}/logout`, { method: 'POST' });
                                  setWaStatus({ connected: false, logged_in: false, jid: '' });
                                  setWaQrCode('');
                                } catch (e) {}
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-400 transition"
                            >
                              Unlink Device
                            </button>
                          ) : (
                            <button
                              onClick={handleScanQr}
                              disabled={waLoading}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {waLoading ? 'Starting Bridge...' : (waQrCode ? 'Refresh QR Code' : 'Scan WhatsApp QR')}
                            </button>
                          )}
                          {waError && <p role="alert" className="mt-2 text-xs text-neutral-300">{waError}</p>}
                        </div>
                      </div>

                      {/* If Authenticated: Display Device Details */}
                      {waStatus.logged_in ? (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-white">Active Session: {waStatus.jid || 'PIHU Desktop'}</span>
                              <p className="text-[11px] text-neutral-400">PIHU AI Agent & Voice Engine can autonomously search contacts, send WhatsApp messages, and read history.</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/20 font-bold shrink-0">
                            REST Port: 8080
                          </span>
                        </div>
                      ) : (
                        /* If Not Authenticated: Display QR Pairing Code and Steps */
                        <div className="p-4 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 space-y-4">
                          <div className="flex flex-col md:flex-row items-center gap-5">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-40 h-40 rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-xl border border-white/20 shrink-0 overflow-hidden">
                                {waQrCode ? (
                                  <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=${encodeURIComponent(waQrCode)}`}
                                    alt="WhatsApp Pairing QR Code"
                                    className="w-full h-full object-contain rounded-lg"
                                  />
                                ) : (
                                  <div className="text-center p-2">
                                    <QrCode className="w-12 h-12 text-neutral-400 mx-auto mb-1 animate-pulse" />
                                    <span className="text-[10px] text-neutral-600 font-semibold block">
                                      {waLoading ? 'Generating QR...' : 'Click "Scan WhatsApp QR"'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {waQrCode && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(waQrCode);
                                    setWaCopiedQr(true);
                                    setTimeout(() => setWaCopiedQr(false), 2000);
                                  }}
                                  className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white transition"
                                >
                                  {waCopiedQr ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">QR Code String Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy QR Payload</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            <div className="flex-1 space-y-2 text-xs">
                              <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">How to Pair Your Phone:</h5>
                              <ol className="space-y-1.5 text-neutral-300 text-[11px] list-decimal list-inside font-medium">
                                <li>Open <strong>WhatsApp</strong> on your mobile phone</li>
                                <li>Tap <strong>Settings</strong> &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong></li>
                                <li>Point your phone camera at the QR code on the left</li>
                                <li>Device will register as <strong>PIHU (Desktop)</strong></li>
                              </ol>
                              <div className="pt-2 flex items-center gap-3">
                                <span className="text-[10px] text-neutral-500 font-mono">CLI Command:</span>
                                <code className="px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono text-neutral-400 border border-white/5">
                                  pihu mcp whatsapp auth
                                </code>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}


            {/* ══════ SECTION 3: WIDGETS ══════ */}
            {activeSidebarCategory === 'widgets' && (
              <div className="space-y-6">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Canvas Widgets</h3>
                <div className="space-y-3">
                  {[
                    { id: 'clock-widget', name: 'Ambient Clock & Weather Widget', desc: 'Real-time time, weather telemetry, and greeting banner' },
                    { id: 'ytmusic-plugin', name: 'YouTube Music Player Window', desc: 'Direct streaming, OAuth playback, search, and queue' },
                    { id: 'task-window', name: 'Task & Todo Manager', desc: 'Interactive task boards with Google Tasks bi-directional sync' },
                    { id: 'orb-widget', name: 'Thinking Orb Particle Canvas', desc: '60 FPS Jakub Antalik orbital state particle physics' },
                  ].map((w) => {
                    const isOpen = useLayoutStore.getState().widgets[w.id]?.isOpen;
                    return (
                      <div
                        key={w.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5"
                      >
                        <div>
                          <h4 className="text-xs font-semibold text-white">{w.name}</h4>
                          <p className="text-[11px] text-neutral-500">{w.desc}</p>
                        </div>
                        <button
                          onClick={() => useLayoutStore.getState().toggleWidget(w.id)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-medium transition ${
                            isOpen
                              ? 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30'
                              : 'bg-white/5 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {isOpen ? 'Visible on Canvas' : 'Hidden'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Dock Position & Magnification */}
                <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-4">
                  <h4 className="text-xs font-semibold text-white">Dock Layout & Magnification</h4>
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div><h5 className="text-sm font-medium text-white">Show dock</h5>
                    <p className="text-xs text-neutral-400 mt-1">Hide the dock for a clear desktop. Press ⌘, or Ctrl+, to reopen Settings.</p></div>
                    <button type="button" role="switch" aria-checked={dockVisible} aria-label="Show dock"
                      onClick={() => setDockVisible(!dockVisible)}
                      className={`shrink-0 w-12 h-7 rounded-full p-1 transition ${dockVisible ? 'bg-white/30' : 'bg-white/[0.045] backdrop-blur-md border border-white/15'}`}>
                      <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${dockVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {['bottom', 'left', 'right'].map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setDockPosition(pos as any)}
                        className={`py-2 rounded-xl border text-xs font-semibold capitalize transition ${
                          dockPosition === pos
                            ? 'bg-white/15 border-white/25 text-white'
                            : 'bg-white/[0.045] backdrop-blur-md border-white/5 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {pos} Dock
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div>
                      <h5 className="text-xs font-semibold text-white">Icon Magnification</h5>
                      <p className="text-[11px] text-neutral-500">Smooth hover scale effect on dock items</p>
                    </div>
                    <button
                      onClick={() => setDockMagnification(!dockMagnification)}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
                        dockMagnification ? 'bg-white/10  ' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                          dockMagnification ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}


            {/* ══════ SECTION 4: NOTIFICATIONS ══════ */}
            {activeSidebarCategory === 'notifications' && (
              <div className="space-y-4">
                {[
                  { title: 'WhatsApp & Gmail Voice Alerts', desc: 'Announce new messages and ask whether to open or read them aloud', state: messageVoiceAlerts, toggle: () => useSettingsStore.getState().setMessageVoiceAlerts(!useSettingsStore.getState().messageVoiceAlerts) },
                  { title: 'Spoken Voice Notifications', desc: 'Announce high-priority task completions and calendar reminders aloud', state: spokenVoiceAlerts, toggle: () => setSpokenVoiceAlerts(!spokenVoiceAlerts) },
                  { title: 'Desktop Banner Alerts', desc: 'Display floating glass notifications on desktop for background events', state: bannerAlerts, toggle: () => setBannerAlerts(!bannerAlerts) },
                  { title: 'Action Completion Chimes', desc: 'Play subtle harmonic tones when voice tools finish executing', state: soundChimes, toggle: () => setSoundChimes(!soundChimes) },
                  { title: 'Do Not Disturb', desc: 'Silence all audio cues and spoken responses during meetings or focus hours', state: doNotDisturb, toggle: () => setDoNotDisturb(!doNotDisturb) },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5">
                    <div>
                      <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                      <p className="text-[11px] text-neutral-500">{item.desc}</p>
                    </div>
                    <button
                      onClick={item.toggle}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
                        item.state ? 'bg-white/10  ' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                          item.state ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}


            {/* ══════ SECTION 5: VOICE & SPEECH ══════ */}
            {activeSidebarCategory === 'voice' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">ElevenLabs API Key (High-Fidelity Cloud Voice)</label>
                  <input
                    type="password"
                    placeholder="sk_..."
                    value={elevenLabsApiKey}
                    onChange={(e) => setElevenLabsConfig(e.target.value, elevenLabsVoiceId)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Voice Model ID</label>
                  <input
                    type="text"
                    value={elevenLabsVoiceId}
                    onChange={(e) => setElevenLabsConfig(elevenLabsApiKey, e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                  />
                </div>

                {/* Speed Slider */}
                <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs text-neutral-300">
                    <span className="font-semibold">Speech Rate Multiplier</span>
                    <span className="text-neutral-400 font-mono">{ttsSpeed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(Number(e.target.value))}
                    className="w-full accent-neutral-500 cursor-pointer"
                  />
                </div>

                {/* Default TTS Strategy */}
                <div className="p-5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-200">Default TTS Fallback Strategy:</h4>
                  <ol className="space-y-2 text-xs text-neutral-400 list-decimal list-inside">
                    <li><strong className="text-neutral-400">Kokoro Neural TTS</strong> (Local On-Device AI — Port 48126)</li>
                    <li><strong className="text-neutral-400">ElevenLabs API</strong> (Cloud High-Fidelity Backup)</li>
                    <li><strong className="text-neutral-300">Native OS SpeechSynthesis</strong> (Offline Fallback)</li>
                  </ol>
                </div>
              </div>
            )}


            {/* ══════ SECTION 6: API & TOKENS (PIHU Token Protocol) ══════ */}
            {activeSidebarCategory === 'tokens' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-neutral-500/10 border border-neutral-500/20 text-xs text-neutral-200/90 leading-relaxed flex items-start gap-3">
                  <Key className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-neutral-400">PIHU Token Failover Protocol Active:</span> When a Gemini key encounters rate limits (429) or quota exhaustion (403), PIHU automatically rotates to the next available API key in real-time.
                  </div>
                </div>

                {/* Add Key Form */}
                <form onSubmit={handleAddKey} className="flex gap-3">
                  <input
                    type="password"
                    placeholder="Enter Gemini API Key (AIzaSy...)"
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10   hover: hover: text-white text-xs font-semibold shadow-lg shadow-neutral-500/20 transition"
                  >
                    <Plus className="w-4 h-4" /> Add Key
                  </button>
                </form>

                {/* Key List Header */}
                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Configured Protocol Keys ({geminiApiKeys.length})
                  </h3>
                  {exhaustedKeyIndices.length > 0 && (
                    <button
                      onClick={resetExhaustedKeys}
                      className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-300 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset Exhausted Status
                    </button>
                  )}
                </div>

                {/* Key Cards */}
                <div className="space-y-2.5">
                  {geminiApiKeys.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-500 rounded-2xl bg-black/20 border border-white/5">
                      No custom keys added yet. Operating on pre-configured environment keys.
                    </div>
                  ) : (
                    geminiApiKeys.map((key, idx) => {
                      const isActive = idx === activeKeyIndex;
                      const isExhausted = exhaustedKeyIndices.includes(idx);
                      const maskedKey = `${key.slice(0, 8)}••••••••••••${key.slice(-4)}`;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                            isActive
                              ? 'bg-neutral-500/10 border-neutral-500/40 text-white shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                              : isExhausted
                              ? 'bg-red-500/5 border-red-500/20 text-neutral-400'
                              : 'bg-white/[0.045] backdrop-blur-md border-white/5 text-neutral-300 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setActiveKeyIndex(idx)}
                              className="text-left font-mono text-xs hover:text-neutral-400 transition"
                            >
                              {maskedKey}
                            </button>

                            {isActive && (
                              <span className="px-2.5 py-0.5 rounded-full bg-neutral-500/20 border border-neutral-500/40 text-[10px] font-bold text-neutral-400">
                                ACTIVE
                              </span>
                            )}
                            {isExhausted && (
                              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-bold text-red-400">
                                QUOTA EXHAUSTED
                              </span>
                            )}
                            {!isActive && !isExhausted && (
                              <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-[10px] font-medium text-neutral-400">
                                READY
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyKey(key, idx)}
                              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition"
                            >
                              {copiedKeyIdx === idx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => removeGeminiKey(idx)}
                              className="p-2 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-white/5 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}


            {/* ══════ SECTION 7: ENGINE DIAGNOSTICS ══════ */}
            {activeSidebarCategory === 'diagnostics' && (
              <div className="space-y-6">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Engine Health Matrix</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-500/10 text-neutral-400 flex items-center justify-center">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">WakeWord Engine</h4>
                        <p className="text-[11px] text-neutral-500">openwakeword + pyaudio (4 models)</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Ready
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-500/10 text-neutral-400 flex items-center justify-center">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Speech STT Server</h4>
                        <p className="text-[11px] text-neutral-500">Whisper C++ (ws://5001)</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Listening
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-500/10 text-neutral-400 flex items-center justify-center">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Kokoro TTS Engine</h4>
                        <p className="text-[11px] text-neutral-500">Flask HTTP (port 48126)</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">MCP Servers Suite</h4>
                        <p className="text-[11px] text-neutral-500">6 Connected Servers</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Connected
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.12] backdrop-blur-lg border border-white/5 flex items-center justify-between text-xs text-neutral-400">
                  <span>Python Runtime Environment:</span>
                  <span className="font-mono text-neutral-400">~/.pihu-os/venv/bin/python (3.10)</span>
                </div>
              </div>
            )}


            {/* ══════ SECTION 8: PRIVACY & SECURITY ══════ */}
            {activeSidebarCategory === 'privacy' && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">Local-First Privacy Architecture</h4>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      Voice wake-word detection, speech transcription, local file operations, and project scaffolds execute 100% on-device on your machine.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">API Key Masking & Storage</h4>
                    <p className="text-[11px] text-neutral-500">Keys are encrypted in browser local storage</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    AES Protected
                  </span>
                </div>
              </div>
            )}


            {/* ══════ SECTION 9: SHORTCUTS ══════ */}
            {activeSidebarCategory === 'shortcuts' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">Global Keyboard Shortcuts</h3>
                {[
                  { keys: ['⌘', 'Space'], action: 'Activate PIHU Voice Assistant' },
                  { keys: ['⌘', ','], action: 'Open PIHU Settings Window' },
                  { keys: ['⌘', 'K'], action: 'Open Action Palette / Command Bar' },
                  { keys: ['⌘', 'T'], action: 'Toggle Task Window' },
                  { keys: ['⌘', 'M'], action: 'Toggle YouTube Music Player' },
                  { keys: ['Esc'], action: 'Dismiss active voice overlay' },
                ].map((sc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5">
                    <span className="text-xs text-neutral-300 font-medium">{sc.action}</span>
                    <div className="flex items-center gap-1.5">
                      {sc.keys.map((k, i) => (
                        <kbd key={i} className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-neutral-300">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* ══════ SECTION 10: PEOPLE & DIRECTORY ══════ */}
            {activeSidebarCategory === 'people' && (
              <div className="space-y-6">
                
                {/* Header with Search and Add Button */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search people by name, email, or phone..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-medium"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setEditingContactId(null);
                      setContactForm({ name: '', nickname: '', email: '', phone: '', notes: '' });
                      setIsContactModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10   hover: hover: text-white text-xs font-semibold shadow-lg shadow-neutral-500/20 transition hover:scale-105"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Person
                  </button>
                </div>

                {/* AI Routing Info Banner */}
                <div className="p-4 rounded-2xl bg-white/10    border border-neutral-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-500/20 border border-neutral-500/40 flex items-center justify-center text-neutral-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Autonomous Agent Dispatch</h4>
                      <p className="text-[11px] text-neutral-300 mt-0.5">
                        Say <span className="text-neutral-300 font-mono font-bold">"pihu send email to [Name]"</span> (Gmail) or <span className="text-emerald-300 font-mono font-bold">"pihu send message to [Name] on whatsapp"</span>.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 px-2.5 py-1 rounded-lg bg-black/[0.12] backdrop-blur-lg border border-white/5">
                    ~/.pihu/contacts.json
                  </span>
                </div>

                {/* Contacts List Grid */}
                {contacts.length === 0 ? (
                  <div className="p-12 text-center rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-neutral-500 mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">No People in Directory Yet</h4>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Add friends, colleagues, or family with their email and WhatsApp phone number so PIHU can message them autonomously.
                    </p>
                    <button
                      onClick={() => {
                        setEditingContactId(null);
                        setContactForm({ name: '', nickname: '', email: '', phone: '', notes: '' });
                        setIsContactModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-500/20 hover:bg-neutral-500/30 border border-neutral-500/40 text-neutral-300 text-xs font-semibold transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Your First Contact
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {contacts
                      .filter(c => 
                        !contactSearchQuery ||
                        c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                        (c.nickname && c.nickname.toLowerCase().includes(contactSearchQuery.toLowerCase())) ||
                        (c.email && c.email.toLowerCase().includes(contactSearchQuery.toLowerCase())) ||
                        (c.phone && c.phone.includes(contactSearchQuery))
                      )
                      .map((c) => {
                        const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'P';
                        return (
                          <div
                            key={c.id}
                            className="p-4 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/5 hover:border-neutral-500/30 transition duration-200 flex flex-col justify-between space-y-3 group shadow-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/10   flex items-center justify-center text-xs font-bold text-white shadow-md">
                                  {initials}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-white group-hover:text-neutral-300 transition">
                                      {c.name}
                                    </h4>
                                    {c.nickname && (
                                      <span className="px-2 py-0.5 rounded-md bg-neutral-500/20 border border-neutral-500/30 text-[9px] font-bold text-neutral-300 font-mono">
                                        {c.nickname}
                                      </span>
                                    )}
                                  </div>
                                  {c.notes && (
                                    <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1 italic">{c.notes}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                <button
                                  onClick={() => {
                                    setEditingContactId(c.id);
                                    setContactForm({
                                      name: c.name,
                                      nickname: c.nickname || '',
                                      email: c.email || '',
                                      phone: c.phone || '',
                                      notes: c.notes || '',
                                    });
                                    setIsContactModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition"
                                  title="Edit Contact"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeContact(c.id)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/5 transition"
                                  title="Delete Contact"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Contact Details Badges */}
                            <div className="space-y-1.5 pt-2 border-t border-white/5 text-[11px]">
                              {c.email && (
                                <div className="flex items-center justify-between text-neutral-300">
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                    <span className="font-mono text-[11px] truncate max-w-[200px]">{c.email}</span>
                                  </div>
                                  <span className="text-[9px] text-neutral-500 font-semibold uppercase">Gmail</span>
                                </div>
                              )}
                              {c.phone && (
                                <div className="flex items-center justify-between text-neutral-300">
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="font-mono text-[11px]">{c.phone}</span>
                                  </div>
                                  <span className="text-[9px] text-emerald-400 font-semibold uppercase">WhatsApp</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Add / Edit Contact Modal Dialog */}
                {isContactModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="relative w-full max-w-md rounded-3xl bg-slate-950 border border-white/10 p-6 space-y-4 shadow-2xl text-white">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-neutral-500/20 border border-neutral-500/40 flex items-center justify-center text-neutral-400">
                            <User className="w-4 h-4" />
                          </div>
                          <h3 className="text-sm font-bold text-white">
                            {editingContactId ? 'Edit Person Details' : 'Add New Person to Directory'}
                          </h3>
                        </div>
                        <button
                          onClick={() => setIsContactModalOpen(false)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-white transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!contactForm.name.trim()) return;
                          if (editingContactId) {
                            updateContact(editingContactId, {
                              name: contactForm.name.trim(),
                              nickname: contactForm.nickname.trim() || undefined,
                              email: contactForm.email.trim() || undefined,
                              phone: contactForm.phone.trim() || undefined,
                              notes: contactForm.notes.trim() || undefined,
                            });
                          } else {
                            addContact({
                              id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                              name: contactForm.name.trim(),
                              nickname: contactForm.nickname.trim() || undefined,
                              email: contactForm.email.trim() || undefined,
                              phone: contactForm.phone.trim() || undefined,
                              notes: contactForm.notes.trim() || undefined,
                            });
                          }
                          setIsContactModalOpen(false);
                        }}
                        className="space-y-3.5"
                      >
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                            Full Name <span className="text-neutral-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Anin, Rahul Sharma, Mayank"
                            value={contactForm.name}
                            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                            className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Nickname / Tag</label>
                            <input
                              type="text"
                              placeholder="e.g. Lead, Friend, Boss"
                              value={contactForm.nickname}
                              onChange={(e) => setContactForm({ ...contactForm, nickname: e.target.value })}
                              className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-300 mb-1">WhatsApp Phone</label>
                            <input
                              type="text"
                              placeholder="e.g. 919876543210"
                              value={contactForm.phone}
                              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                              className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Gmail / Email Address</label>
                          <input
                            type="email"
                            placeholder="e.g. anin@example.com"
                            value={contactForm.email}
                            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                            className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-300 mb-1">AI Notes / Instructions</label>
                          <textarea
                            rows={2}
                            placeholder="e.g. Message regarding project proposals, send updates here"
                            value={contactForm.notes}
                            onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                            className="w-full px-3.5 py-2 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setIsContactModalOpen(false)}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-400 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-white/10   hover: hover: text-white text-xs font-semibold shadow-lg shadow-neutral-500/20 transition"
                          >
                            {editingContactId ? 'Save Changes' : 'Add Person'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            )}


            {/* ══════ SECTION 11: ABOUT PIHU ══════ */}
            {activeSidebarCategory === 'about' && (
              <div className="p-8 rounded-3xl bg-white/[0.045] backdrop-blur-md border border-white/5 space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10    flex items-center justify-center text-white mx-auto shadow-2xl shadow-neutral-500/30">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">PIHU OS v1.0.0</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Created with ❤️ by <strong>Mayank Jha</strong>
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-black/[0.12] backdrop-blur-lg border border-white/5 text-[11px] font-mono text-neutral-300 max-w-md mx-auto">
                  Tauri v2 • React 19 • Python 3.10 • Rust Core • MCP Suite
                </div>
              </div>
            )}

            {activeSidebarCategory === 'spirits' && <SpiritsSettings />}

          </div>

        </div>

      </GlassCard>

    </div>
  );
};
