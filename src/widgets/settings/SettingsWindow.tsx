import { SoftwareUpdate } from '../../core/updates/SoftwareUpdate';
import { SpotifyConnection, SpotifyDeveloperSettings } from './SpotifyConnection';
import { useVoiceStore } from '../../stores/voiceStore';
import { ensureWhatsAppBridge, WHATSAPP_API_URL } from '../../core/services/whatsappBridge';
import { GlassCard } from '../../shared/components/GlassCard/GlassCard';
import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { DEFAULT_KEYBINDINGS, useSettingsStore } from '../../stores/settingsStore';
import type { KeybindingAction } from '../../stores/settingsStore';
import { acceleratorFromKeyboardEvent, formatAccelerator } from '../../core/shortcuts';
import { SpiritsSettings } from '../../features/spirits/SpiritsSettings';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { InstalledMcpConnections } from './InstalledMcpConnections';
import { EngineDiagnosticsSummary } from './EngineDiagnosticsSummary';
import { useDiagnosticsStore } from '../../core/voice/diagnosis/EngineDiagnostics';
import { motion } from 'framer-motion';
import pihuLogo from '../../assets/logo.png';
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
  Search,
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

const SHORTCUT_ROWS: { action: KeybindingAction; label: string; scope: 'Global' | 'In PIHU' }[] = [
  { action: 'voice', label: 'Activate PIHU Voice Assistant', scope: 'Global' },
  { action: 'settings', label: 'Open PIHU Settings Window', scope: 'In PIHU' },
  { action: 'commandPalette', label: 'Open Command Palette', scope: 'In PIHU' },
  { action: 'globalCommandPalette', label: 'Open Command Palette from any app', scope: 'Global' },
  { action: 'tasks', label: 'Toggle Task Window', scope: 'In PIHU' },
  { action: 'music', label: 'Toggle YouTube Music Player', scope: 'In PIHU' },
  { action: 'marketplace', label: 'Open PIHU Market', scope: 'In PIHU' },
  { action: 'dismissOverlay', label: 'Dismiss active voice overlay', scope: 'In PIHU' },
];

const ShortcutSettings = () => {
  const keybindings = useSettingsStore(state => state.keybindings);
  const setKeybinding = useSettingsStore(state => state.setKeybinding);
  const setKeybindings = useSettingsStore(state => state.setKeybindings);
  const [recording, setRecording] = useState<KeybindingAction | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = acceleratorFromKeyboardEvent(event);
      if (!accelerator) return;
      event.preventDefault();
      event.stopPropagation();

      const conflict = SHORTCUT_ROWS.find(row => row.action !== recording && keybindings[row.action] === accelerator);
      if (conflict) {
        setError(`That key is already assigned to “${conflict.label}”.`);
        setRecording(null);
        return;
      }

      setError('');
      setKeybinding(recording, accelerator);
      setRecording(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [keybindings, recording, setKeybinding]);

  useEffect(() => {
    const onShortcutError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setError(detail || 'PIHU could not register that global shortcut. Choose another combination.');
    };
    window.addEventListener('pihu-shortcut-error', onShortcutError);
    return () => window.removeEventListener('pihu-shortcut-error', onShortcutError);
  }, []);

  return (
    <div className="space-y-3">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Keyboard Shortcuts</h3>
          <p className="mt-1 text-[11px] text-neutral-500">Select a shortcut, then press your preferred key combination.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setKeybindings({ ...DEFAULT_KEYBINDINGS }); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-neutral-300 hover:bg-white/5">Restore defaults</button>
      </div>

      {SHORTCUT_ROWS.map(row => (
        <div key={row.action} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.045] p-3.5 backdrop-blur-md">
          <div className="min-w-0">
            <span className="block text-xs font-medium text-neutral-200">{row.label}</span>
            <span className="mt-1 block text-[10px] text-neutral-500">{row.scope === 'Global' ? 'Works while PIHU is in the background' : 'Works while PIHU is focused'}</span>
          </div>
          <button type="button" onClick={() => { setError(''); setRecording(row.action); }} className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 transition-colors ${recording === row.action ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/10'}`} aria-label={`Change shortcut for ${row.label}`}>
            {recording === row.action ? <span className="px-2 text-[11px]">Press keys…</span> : formatAccelerator(keybindings[row.action]).map((key, index) => <kbd key={`${key}-${index}`} className="min-w-7 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-center text-[11px] font-mono font-bold">{key}</kbd>)}
          </button>
        </div>
      ))}

      {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-200">{error}</p>}
      {!isTauri() && <p className="text-[10px] text-neutral-500">Global shortcuts activate only in the installed desktop app.</p>}
    </div>
  );
};

export const SettingsWindow: React.FC = () => {
  const quietDesktopMode = useSettingsStore(state => state.quietDesktopMode);
  const setQuietDesktopMode = useSettingsStore(state => state.setQuietDesktopMode);
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
    connectedGoogleAccounts,
    developerMode,
    setDeveloperMode,
    removeConnectedGoogleAccount,
    setPrimaryGoogleAccount,
    glassOpacity, setGlassOpacity, reduceTransparency, setReduceTransparency,
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
    sarvamApiKey,
    setSarvamApiKey,
    sarvamSpeaker,
    setSarvamSpeaker,
    sarvamLanguageCode,
    setSarvamLanguageCode,
    sttEnginePreference,
    setSttEnginePreference,
    ttsEnginePreference,
    setTtsEnginePreference,
  } = useSettingsStore();

  const diagnostics = useDiagnosticsStore();
  const [sarvamKeyInput, setSarvamKeyInput] = useState(sarvamApiKey);
  const [showSarvamKey, setShowSarvamKey] = useState(false);
  const [isTestingSarvam, setIsTestingSarvam] = useState(false);
  const [sarvamTestStatus, setSarvamTestStatus] = useState<string | null>(null);
  const [isTestingElevenLabs, setIsTestingElevenLabs] = useState(false);
  const [elevenLabsTestStatus, setElevenLabsTestStatus] = useState<string | null>(null);

  const [newKeyInput, setNewKeyInput] = useState('');
  const [copiedKeyIdx, setCopiedKeyIdx] = useState<number | null>(null);
  const [googleOAuthStarting, setGoogleOAuthStarting] = useState(false);
  const [googleOAuthMessage, setGoogleOAuthMessage] = useState('');
  const [googleOAuthError, setGoogleOAuthError] = useState('');
  const [appVersion, setAppVersion] = useState('Loading…');
  useEffect(() => {
    if (activeSidebarCategory !== 'diagnostics') return;
    const refresh = () => { if (!document.hidden) void useDiagnosticsStore.getState().runDiagnosis(); };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [activeSidebarCategory]);

  useEffect(() => {
    let active = true;
    void getVersion().then(version => {
      if (active) setAppVersion(version);
    }).catch(() => {
      if (active) setAppVersion(import.meta.env.VITE_APP_VERSION || 'Development');
    });
    return () => { active = false; };
  }, []);
  
  // MCP Inspector & In-Place Navigation states
  const [activeMcpDetailId, setActiveMcpDetailId] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => { setActiveMcpDetailId((event as CustomEvent<string>).detail); sessionStorage.removeItem('pihu-configure-mcp'); };
    window.addEventListener('pihu-configure-mcp', open);
    const pending = sessionStorage.getItem('pihu-configure-mcp');
    if (pending) { setActiveMcpDetailId(pending); sessionStorage.removeItem('pihu-configure-mcp'); }
    return () => window.removeEventListener('pihu-configure-mcp', open);
  }, []);

  // General Page PIHU OS States
  const [userName, setUserName] = useState('Sir Mayank');
  const [workspacePath, setWorkspacePath] = useState('~/Documents/projects/pihu-os');
  const [autoStartBoot, setAutoStartBoot] = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);

  // WhatsApp Bridge & Device Pairing States
  const [waStatus, setWaStatus] = useState<{
    connected: boolean;
    logged_in: boolean;
    has_session?: boolean;
    reachable?: boolean;
    jid: string;
    os?: string;
    platform?: string;
    auth_state?: string;
  }>({ connected: false, logged_in: false, jid: '' });
  const [waLoading, setWaLoading] = useState(false);
  const [waUnlinking, setWaUnlinking] = useState(false);
  const waUnlinkingRef = useRef(false);
  const waStatusRevisionRef = useRef(0);
  const [waAuthPageOpened, setWaAuthPageOpened] = useState(false);
  const [waError, setWaError] = useState('');
  const waHasSession = waStatus.has_session ?? waStatus.logged_in;

  // WhatsApp authentication belongs to the local bridge. The desktop, CLI and
  // REPL deliberately consume this same API/session instead of owning separate clients.
  const handleScanQr = async () => {
    const reopenExistingPage = waAuthPageOpened;
    setWaError('');
    setWaLoading(true);
    try {
      await ensureWhatsAppBridge();
      if (reopenExistingPage) {
        const reopenResponse = await fetch(`${WHATSAPP_API_URL}/open-auth-page?reopen=true`, {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
        });
        if (!reopenResponse.ok) {
          const detail = await reopenResponse.text();
          throw new Error(detail || `Could not reopen the PIHU WhatsApp auth page (HTTP ${reopenResponse.status}).`);
        }
        setWaAuthPageOpened(true);
        return;
      }
      setWaAuthPageOpened(false);
      const startResponse = await fetch(`${WHATSAPP_API_URL}/pair`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });
      if (!startResponse.ok) {
        const detail = await startResponse.text();
        throw new Error(detail || `WhatsApp pairing could not start (HTTP ${startResponse.status}).`);
      }

      const started = await startResponse.json().catch(() => ({}));
      if (started.logged_in && started.connected) {
        setWaStatus(prev => ({ ...prev, connected: true, logged_in: true, has_session: true, reachable: true, jid: started.jid || 'PIHU Desktop' }));
      }

      // Open the auth page served by this bridge. QR and sync state stay local.
      const openResponse = await fetch(`${WHATSAPP_API_URL}/open-auth-page`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });
      if (!openResponse.ok) {
        const detail = await openResponse.text();
        throw new Error(detail || `Could not open the PIHU WhatsApp auth page (HTTP ${openResponse.status}).`);
      }
      setWaAuthPageOpened(true);
    } catch (e) {
      setWaError(e instanceof Error ? e.message : String(e));
    } finally {
      setWaLoading(false);
    }
  };

  // WhatsApp Bridge live status & QR poller
  useEffect(() => {
    if (activeSidebarCategory !== 'connections' || activeMcpDetailId !== 'pihu-whatsapp-mcp') return;
    let isMounted = true;
    let polling = false;
    const fetchWaStatus = async () => {
      if (polling || waUnlinkingRef.current) return;
      const revision = waStatusRevisionRef.current;
      const isCurrent = () => revision === waStatusRevisionRef.current && !waUnlinkingRef.current;
      polling = true;
      try {
        let isConnected = false;
        let isLoggedIn = false;
        let hasSession = false;

        // 1. Check status endpoint
        try {
          const res = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (typeof data.logged_in !== 'boolean' || typeof data.connected !== 'boolean') {
              throw new Error('Port 8080 is not serving the WhatsApp bridge.');
            }
            isConnected = true;
            if (isMounted) setWaError('');
            isLoggedIn = !!data.logged_in;
            hasSession = data.has_session ?? (data.logged_in || data.auth_state === "reconnecting");
            if (isMounted && isCurrent()) {
              setWaStatus({
                has_session: hasSession,
                reachable: true,
                connected: !!data.connected,
                logged_in: !!data.logged_in,
                jid: data.jid || '',
                os: data.os || 'PIHU',
                platform: data.platform || 'PIHU Desktop',
                auth_state: data.auth_state,
              });
            }
          }
        } catch (_) {}

        // 2. If bridge is active and not logged in, query /api/pair for active QR code
        if (isConnected && !isLoggedIn && !hasSession) {
          try {
            const pairRes = await fetch(`${WHATSAPP_API_URL}/pair`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
            if (pairRes.ok) {
              const pairData = await pairRes.json();
              if (isMounted && isCurrent()) {
                if (pairData.logged_in && pairData.connected) {
                  setWaStatus(prev => ({ ...prev, logged_in: true, has_session: true, connected: true, reachable: true }));
                } else if (pairData.qr_code) {
                  setWaAuthPageOpened(true);
                }
              }
            }
          } catch (_) {}
        }

        // 3. If bridge is offline
        if (!isConnected) {
          if (isMounted && isCurrent()) {
            setWaStatus(prev => ({ ...prev, connected: false, logged_in: false, reachable: false }));
          }
          // Auto-start bridge if user is actively in the Connections section
          if (activeSidebarCategory === 'connections') {
            ensureWhatsAppBridge().catch(error => {
              if (isMounted) setWaError(error instanceof Error ? error.message : String(error));
            });
          }
        }
      } catch (e) {
        if (isMounted && isCurrent()) {
          setWaStatus(prev => ({ ...prev, connected: false, logged_in: false, reachable: false }));
        }
      } finally {
        polling = false;
      }
    };

    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSidebarCategory, activeMcpDetailId]);

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

  // Sync Google Workspace accounts from token file
  useEffect(() => {
    let isMounted = true;
    let unlistenGoogleConnected: (() => void) | undefined;
    let unlistenGoogleError: (() => void) | undefined;

    const syncAccountsFromFile = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<string>('read_google_accounts');
        
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
    void listen<{ name?: string; email?: string; picture?: string }>('google-oauth-connected', (event) => {
      void syncAccountsFromFile();
      const account = event.payload.email || event.payload.name || 'Google account';
      setGoogleOAuthMessage(`${account} connected successfully. PIHU is ready to use Google Workspace.`);
      setGoogleOAuthError('');
      setGoogleOAuthStarting(false);
    }).then((unlisten) => {
      if (isMounted) unlistenGoogleConnected = unlisten;
      else unlisten();
    });
    void listen<string>('google-oauth-error', (event) => {
      setGoogleOAuthMessage('');
      setGoogleOAuthError(event.payload || 'Google sign-in could not be completed.');
      setGoogleOAuthStarting(false);
    }).then((unlisten) => {
      if (isMounted) unlistenGoogleError = unlisten;
      else unlisten();
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      unlistenGoogleConnected?.();
      unlistenGoogleError?.();
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

  // Settings sections
  const sidebarItems = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'connections', label: 'Connections', icon: Briefcase, badge: 'MCP' },
    { id: 'advanced', label: 'Advanced Settings', icon: Wrench },
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

  const quietModeAccentClass = 'bg-emerald-500 focus-visible:ring-emerald-300/70';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 sm:p-6 select-none"
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      
      {/* Main Glass Window Frame */}
      <motion.div
        className="relative w-full max-w-5xl"
        initial={{ opacity: 0, scale: 0.92, y: 18, filter: 'blur(12px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.82 }}
      >
      <GlassCard blur="xl" frost="heavy" className="relative w-full h-[min(760px,90vh)] rounded-3xl overflow-hidden flex text-white font-sans" style={{ backgroundColor: 'rgba(18,18,18,0.18)', backdropFilter: 'blur(40px) saturate(115%)', WebkitBackdropFilter: 'blur(40px) saturate(115%)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
        
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
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <img src={pihuLogo} alt="PIHU logo" className="w-9 h-9 object-contain" />
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
                    setActiveMcpDetailId(null);
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
                {activeSidebarCategory === 'connections' && (activeMcpDetailId ? `${activeMcpDetailId} · Configuration` : 'Connections & MCP Servers')}
                {activeSidebarCategory === 'advanced' && 'Advanced Settings'}
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
                {activeSidebarCategory === 'general' && 'Operating system profile, memory cache, and assistant persona.'}
                {activeSidebarCategory === 'connections' && (activeMcpDetailId ? 'Configure this MCP, connect accounts and manage its installation.' : 'Installed MCPs, accounts and configuration.')}
                {activeSidebarCategory === 'advanced' && 'Developer options and advanced service configuration.'}
                {activeSidebarCategory === 'widgets' && 'Toggle canvas widgets, dock magnification, and screen layout.'}
                {activeSidebarCategory === 'spirits' && 'Add animated companions to your desktop and make them your own.'}
                {activeSidebarCategory === 'notifications' && 'Control voice spoken alerts, desktop banners, and chime sounds.'}
                {activeSidebarCategory === 'voice' && 'Configure Kokoro Neural TTS, ElevenLabs voice models, and speech latency.'}
                {activeSidebarCategory === 'tokens' && 'Multi-key failover protocol for uninterrupted Gemini AI operations.'}
                {activeSidebarCategory === 'diagnostics' && 'Live real-time telemetry for voice servers, STT, and MCP tools.'}
                {activeSidebarCategory === 'privacy' && 'On-device local AI processing, encrypted keys, and data boundaries.'}
                {activeSidebarCategory === 'shortcuts' && 'Global hotkeys and quick action triggers across PIHU OS.'}
                {activeSidebarCategory === 'people' && 'Define contacts, email addresses, and phone numbers for AI messaging via Gmail and WhatsApp.'}
                {activeSidebarCategory === 'about' && 'Learn about PIHU OS and the tools that make it your personal AI desktop companion.'}
              </p>
            </div>


          </div>

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

            {/* ══════ SECTION 1: GENERAL (PIHU OS Core Profile) ══════ */}
            {activeSidebarCategory === 'general' && (
              <div className="space-y-6">
                <SoftwareUpdate />

                <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/5 bg-white/[0.045] p-5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Quiet Desktop Mode</h4>
                    <p className="mt-1 text-[11px] text-neutral-400">Hide PIHU’s desktop widgets and dock while you work in other apps. Use your voice shortcut and ask PIHU to open Settings to turn this off.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={quietDesktopMode}
                    onClick={() => setQuietDesktopMode(!quietDesktopMode)}
                    className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-white/10 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${quietDesktopMode ? quietModeAccentClass : 'bg-white/15 focus-visible:ring-white/50'}`}
                    aria-label="Quiet Desktop Mode"
                  >
                    <span className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${quietDesktopMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* OS Identity & Salutation */}
                <div className="p-5 rounded-3xl settings-frost-panel space-y-4">
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

                {/* System Startup & Memory Cache Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-3xl settings-frost-panel flex items-center justify-between">
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

                  <div className="p-5 rounded-3xl settings-frost-panel flex items-center justify-between">
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
                <div className="p-5 rounded-3xl settings-frost-panel space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Appearance & Readability</h4>
                      <p className="text-[11px] text-neutral-400">Adjust glass depth and contrast. Quiet mode adds a subtle dark tint while keeping the glass frosted.</p>
                    </div>

                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-neutral-300">
                      <span>Background blur</span>
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
                  <label className="block space-y-2 text-xs text-neutral-300"><span className="flex justify-between">Glass tint <span>{Math.round(glassOpacity * 100)}%</span></span><input aria-label="Glass tint" type="range" min="20" max="90" value={Math.round(glassOpacity*100)} onChange={e => setGlassOpacity(Number(e.target.value)/100)} className="w-full accent-neutral-400"/></label>
                  <label className="flex items-center justify-between gap-4 text-xs text-neutral-200"><span>Reduce transparency<small className="mt-1 block text-neutral-400">Use solid surfaces for maximum readability.</small></span><input type="checkbox" checked={reduceTransparency} onChange={e => setReduceTransparency(e.target.checked)} className="h-4 w-4 accent-neutral-400"/></label>
                  <button type="button" onClick={() => {setBlurIntensity(24);setGlassOpacity(0.35);setReduceTransparency(false);}} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">Reset appearance</button>
                </div>

              </div>
            )}

            {/* ══════ ADVANCED SETTINGS ══════ */}
            {activeSidebarCategory === 'advanced' && (
              <div className="space-y-6">
                <section className="p-5 rounded-3xl settings-frost-panel space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-neutral-200"><Code className="w-5 h-5" /></div>
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Developer Settings</h3>
                        <p className="text-[11px] text-neutral-400 mt-1 max-w-lg">Reveal service credentials and redirect configuration for local integrations.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={developerMode}
                      aria-label="Developer’s Mode"
                      onClick={() => setDeveloperMode(!developerMode)}
                      className={`w-12 h-6 shrink-0 flex items-center rounded-full p-1 transition ${developerMode ? 'bg-white/25' : 'bg-neutral-700'}`}
                    >
                      <span className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${developerMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {!developerMode && <p className="text-xs text-neutral-400 border-t border-white/10 pt-4">Turn on Developer’s Mode to edit Spotify app credentials. Your Spotify account connection stays available below.</p>}
                </section>
                {developerMode && <SpotifyDeveloperSettings enabled={true} />}
              </div>
            )}


            {/* ══════ SECTION 2: CONNECTIONS (In-Place MCP Tool Explorer) ══════ */}
            {activeSidebarCategory === 'connections' && <InstalledMcpConnections
              selectedId={activeMcpDetailId}
              onSelect={setActiveMcpDetailId}
              renderConfiguration={id => <>
                {id === 'google-workspace-mcp' && <>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.045] p-4 text-xs text-neutral-300">
                      Google sign-in is securely handled by pihu.nfks.co.in. Your Google client secret stays on the PIHU server.
                    </div>

                    {/* Connected Google Accounts List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                          Connected Google Accounts ({connectedGoogleAccounts.length})
                        </h3>
                        <button
                          type="button"
                          disabled={googleOAuthStarting}
                          onClick={async () => {
                            setGoogleOAuthStarting(true);
                            setGoogleOAuthError('');
                            setGoogleOAuthMessage('Preparing secure Google sign-in…');
                            try {
                              const { invoke } = await import('@tauri-apps/api/core');
                              const result = await invoke<{ provider?: string }>('google_oauth_start');
                              setGoogleOAuthMessage(result.provider === 'local'
                                ? 'PIHU hosted sign-in is unavailable. Using the Google OAuth client configured on this device; complete authorization in your browser.'
                                : 'PIHU sign-in opened. Complete Google authorization in your browser to link the account.');
                            } catch (error) {
                              setGoogleOAuthMessage('');
                              setGoogleOAuthError(String(error));
                            } finally {
                              setGoogleOAuthStarting(false);
                            }
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shadow-lg shadow-neutral-500/20 transition disabled:cursor-wait disabled:opacity-60"
                        >
                          {googleOAuthStarting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {googleOAuthStarting ? 'Preparing…' : 'Link Another Account'}
                        </button>
                      </div>

                      {googleOAuthMessage && <p role="status" className="text-xs text-emerald-300">{googleOAuthMessage}</p>}
                      {googleOAuthError && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">Google sign-in could not start: {googleOAuthError}</p>}

                      <div className="space-y-2.5">
                        {connectedGoogleAccounts.map((account, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-4 rounded-2xl settings-frost-panel hover:border-white/10 transition"
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

                </>}
                {id === 'spotify-mcp' && <>{developerMode && <SpotifyDeveloperSettings enabled={true} />}<SpotifyConnection onConnectionChange={() => {}} /></>}
                {id === 'pihu-whatsapp-mcp' && <>
                    {/* WhatsApp MCP Device Pairing & QR Code Card */}
                    <div className="p-5 rounded-2xl settings-frost-panel space-y-4">
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
                                {waStatus.reachable === false ? '○ Bridge Offline' : waStatus.logged_in && waStatus.connected ? '● Linked & Connected' : waStatus.has_session ? '○ Linked · Reconnecting' : waStatus.reachable ? '○ Pairing Required' : '○ Checking Connection'}
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
                              if (confirm('Clear local WhatsApp chats and message history? This will not unlink your device.')) {
                                try {
                                  const response = await fetch(`${WHATSAPP_API_URL}/clear`, { method: 'POST' });
                                  if (!response.ok) throw new Error(await response.text());
                                  setWaError('');
                                } catch (e) {
                                  setWaError(e instanceof Error ? e.message : 'Could not clear WhatsApp data.');
                                }
                              }
                            }}
                            title="Clear local WhatsApp session & message database"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-xs font-semibold text-neutral-400 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear Data
                          </button>

                          {waHasSession ? (
                            <button
                              disabled={waUnlinking}
                              onClick={async () => {
                                waStatusRevisionRef.current += 1;
                                waUnlinkingRef.current = true;
                                setWaUnlinking(true);
                                setWaError('');
                                try {
                                  const response = await fetch(`${WHATSAPP_API_URL}/logout`, { method: 'POST', signal: AbortSignal.timeout(15000) });
                                  const result = await response.json().catch(() => ({}));
                                  if (!response.ok || result.success !== true) throw new Error(result.error || 'The WhatsApp bridge could not unlink this device.');
                                  if (result.has_session !== false || result.logged_in !== false) {
                                    throw new Error('The bridge did not confirm that its saved WhatsApp session was removed. Restart the WhatsApp bridge and try unlinking again.');
                                  }
                                  setWaStatus({ connected: false, logged_in: false, has_session: false, reachable: true, jid: '', auth_state: 'waiting' });
                                  setWaAuthPageOpened(false);
                                  if (result.remote_unlinked === false) setWaError('The local PIHU session was removed. To unlink PIHU from WhatsApp completely, remove it from WhatsApp → Linked Devices.');
                                } catch (e) {
                                  setWaError(e instanceof Error ? e.message : 'Could not unlink the WhatsApp device.');
                                } finally {
                                  // Ignore any status response that started before logout; the bridge is the source of truth.
                                  waUnlinkingRef.current = false;
                                  setWaUnlinking(false);
                                }
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-xs font-semibold text-red-400 transition"
                            >
                              {waUnlinking ? 'Unlinking…' : 'Unlink Device'}
                            </button>
                          ) : (
                            <button
                              onClick={handleScanQr}
                              disabled={waLoading}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {waLoading ? (waAuthPageOpened ? 'Opening QR page…' : 'Starting WhatsApp…') : (waAuthPageOpened ? 'Open QR Pairing Page' : 'Pair WhatsApp')}
                            </button>
                          )}
                          {waError && <p role="alert" className="mt-2 text-xs text-neutral-300">{waError}</p>}
                        </div>
                      </div>

                      {/* If Authenticated: Display Device Details */}
                      {waHasSession ? (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-white">Saved Session: {waStatus.jid || 'PIHU Desktop'}</span>
                              <p className="text-[11px] text-neutral-400">PIHU AI Agent & Voice Engine can autonomously search contacts, send WhatsApp messages, and read history.</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/20 font-bold shrink-0">
                            REST Port: 8080
                          </span>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10">
                          <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0" />
                            <div className="space-y-2 text-xs">
                              <h5 className="font-bold text-white">Secure WhatsApp pairing</h5>
          <p className="text-neutral-400">{waAuthPageOpened ? 'The local PIHU auth page is open in your browser. Scan its live QR code with WhatsApp.' : 'PIHU opens a local auth page with the live QR code. The QR is never displayed in Settings.'}</p>
                              <ol className="space-y-1 text-neutral-300 text-[11px] list-decimal list-inside font-medium">
                                <li>Open WhatsApp on your phone</li>
                                <li>Go to Settings → Linked Devices → Link a Device</li>
                                <li>Scan the QR on the PIHU auth page</li>
                              </ol>
                              <div className="pt-1 text-[10px] text-neutral-500">Pairing uses the local endpoint assigned by the MCP manager.</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>                </>}
              </>}
            />}

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
                        className="flex items-center justify-between p-4 rounded-2xl settings-frost-panel"
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
                <div className="p-4 rounded-2xl settings-frost-panel space-y-4">
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
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl settings-frost-panel">
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

                {/* ── Sarvam AI Cloud STT & TTS ── */}
                <div className="p-5 rounded-2xl settings-frost-panel space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-neutral-400" />
                      Sarvam AI — Cloud STT & TTS
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Speaker: <strong className="text-neutral-200">{sarvamSpeaker}</strong> ({sarvamLanguageCode})
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">API Subscription Key</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showSarvamKey ? 'text' : 'password'}
                            value={sarvamKeyInput}
                            onChange={(e) => setSarvamKeyInput(e.target.value)}
                            placeholder="Paste your SARVAM_API_KEY..."
                            className="w-full px-3.5 py-2.5 pr-16 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSarvamKey(!showSarvamKey)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white transition"
                          >
                            {showSarvamKey ? 'Hide' : 'Show'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSarvamApiKey(sarvamKeyInput);
                            diagnostics.runDiagnosis();
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
                        >
                          Save Key
                        </button>

                        <button
                          type="button"
                          disabled={isTestingSarvam || !sarvamKeyInput}
                          onClick={async () => {
                            setIsTestingSarvam(true);
                            setSarvamTestStatus('Synthesizing speech with Aarti...');
                            try {
                              const res = await fetch('https://api.sarvam.ai/text-to-speech', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'api-subscription-key': sarvamKeyInput.trim(),
                                },
                                body: JSON.stringify({
                                  text: 'नमस्ते! मैं पीहू हूँ। सर्वम एआई वॉइस इंजन सक्रिय है।',
                                  language_code: sarvamLanguageCode,
                                  speaker: sarvamSpeaker,
                                  model: 'bulbul:v4-flash',
                                }),
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}`);
                              const data = await res.json();
                              if (data.audios?.[0]) {
                                const audio = new Audio(`data:audio/wav;base64,${data.audios[0]}`);
                                await audio.play();
                                setSarvamTestStatus('✓ Playing Aarti sample audio!');
                              }
                            } catch (e: any) {
                              setSarvamTestStatus(`✗ Error: ${e.message}`);
                            } finally {
                              setIsTestingSarvam(false);
                              setTimeout(() => setSarvamTestStatus(null), 4000);
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-neutral-300" />
                          {isTestingSarvam ? 'Testing...' : 'Test Voice'}
                        </button>
                      </div>
                      {sarvamTestStatus && (
                        <p className="text-[11px] text-neutral-400 italic mt-1.5">{sarvamTestStatus}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Speaker Voice</label>
                        <select
                          value={sarvamSpeaker}
                          onChange={(e) => setSarvamSpeaker(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500 transition appearance-none"
                        >
                          <option value="aarti_hi_customer">Aarti (Hindi Customer)</option>
                          <option value="arvind">Arvind</option>
                          <option value="amol">Amol</option>
                          <option value="meera">Meera</option>
                          <option value="amartya">Amartya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Language Code</label>
                        <select
                          value={sarvamLanguageCode}
                          onChange={(e) => setSarvamLanguageCode(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500 transition appearance-none"
                        >
                          <option value="hi-IN">Hindi (hi-IN)</option>
                          <option value="en-IN">English India (en-IN)</option>
                          <option value="bn-IN">Bengali (bn-IN)</option>
                          <option value="ta-IN">Tamil (ta-IN)</option>
                          <option value="te-IN">Telugu (te-IN)</option>
                          <option value="kn-IN">Kannada (kn-IN)</option>
                          <option value="ml-IN">Malayalam (ml-IN)</option>
                          <option value="mr-IN">Marathi (mr-IN)</option>
                          <option value="gu-IN">Gujarati (gu-IN)</option>
                          <option value="od-IN">Odia (od-IN)</option>
                          <option value="pa-IN">Punjabi (pa-IN)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ElevenLabs Cloud TTS ── */}
                <div className="p-5 rounded-2xl settings-frost-panel space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                    ElevenLabs — High-Fidelity Cloud TTS
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">API Key</label>
                      <input
                        type="password"
                        placeholder="sk_..."
                        value={elevenLabsApiKey}
                        onChange={(e) => setElevenLabsConfig(e.target.value, elevenLabsVoiceId)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Voice Model ID</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="MmQVkVZnQ0dUbfWzcW6f"
                          value={elevenLabsVoiceId}
                          onChange={(e) => setElevenLabsConfig(elevenLabsApiKey, e.target.value)}
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500 transition"
                        />
                        <button
                          type="button"
                          disabled={isTestingElevenLabs || !elevenLabsApiKey}
                          onClick={async () => {
                            setIsTestingElevenLabs(true);
                            setElevenLabsTestStatus('Generating speech with ElevenLabs...');
                            try {
                              const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId.trim() || 'MmQVkVZnQ0dUbfWzcW6f'}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'xi-api-key': elevenLabsApiKey.trim(),
                                },
                                body: JSON.stringify({
                                  text: 'Hello! I am PIHU, your personal AI assistant. ElevenLabs voice engine is now active.',
                                  model_id: 'eleven_multilingual_v2',
                                  voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                                }),
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const audio = new Audio(url);
                              audio.onended = () => URL.revokeObjectURL(url);
                              await audio.play();
                              setElevenLabsTestStatus('✓ Playing ElevenLabs sample audio!');
                            } catch (e: any) {
                              setElevenLabsTestStatus(`✗ Error: ${e.message}`);
                            } finally {
                              setIsTestingElevenLabs(false);
                              setTimeout(() => setElevenLabsTestStatus(null), 5000);
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-neutral-300" />
                          {isTestingElevenLabs ? 'Testing...' : 'Test Voice'}
                        </button>
                      </div>
                      {elevenLabsTestStatus && (
                        <p className="text-[11px] text-neutral-400 italic mt-1.5">{elevenLabsTestStatus}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Speed Slider */}
                <div className="p-4 rounded-2xl settings-frost-panel space-y-2">
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
                <div className="p-5 rounded-2xl settings-frost-panel space-y-3">
                  <h4 className="text-xs font-bold text-neutral-200">Default TTS Fallback Strategy:</h4>
                  <ol className="space-y-2 text-xs text-neutral-400 list-decimal list-inside">
                    <li><strong className="text-neutral-400">Kokoro Neural TTS</strong> (Local On-Device AI — Port 48126)</li>
                    <li><strong className="text-neutral-400">Sarvam AI</strong> (Cloud Hindi/Hinglish TTS — Aarti)</li>
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
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold shadow-lg shadow-neutral-500/20 transition"
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

                {/* ── STT / TTS Engine Preference ── */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Engine Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">STT Engine Preference</label>
                      <select
                        value={sttEnginePreference}
                        onChange={(e) => {
                          setSttEnginePreference(e.target.value as any);
                          setTimeout(() => diagnostics.runDiagnosis(), 100);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500 transition appearance-none"
                      >
                        <option value="auto">Auto Fallback (Whisper → Sarvam → Gemini Live)</option>
                        <option value="whisper">Local Whisper.cpp Only (ws://5001)</option>
                        <option value="sarvam">Sarvam AI Cloud STT (Hindi/Hinglish)</option>
                        <option value="gemini_live">Gemini Live STT API (Cloud Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">TTS Engine Preference</label>
                      <select
                        value={ttsEnginePreference}
                        onChange={(e) => {
                          setTtsEnginePreference(e.target.value as any);
                          setTimeout(() => diagnostics.runDiagnosis(), 100);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500 transition appearance-none"
                      >
                        <option value="auto">Auto Fallback (Kokoro → Sarvam AI → ElevenLabs → Native)</option>
                        <option value="kokoro">Local Kokoro Neural Synthesizer (Port 48126)</option>
                        <option value="sarvam">Sarvam AI (Aarti - Hindi/Hinglish - hi-IN)</option>
                        <option value="elevenlabs">ElevenLabs Multilingual (Cloud)</option>
                        <option value="native">macOS Native Speech (Web Speech API)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Sarvam AI Cloud Configuration ── */}
                <div className="p-5 rounded-2xl settings-frost-panel space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-neutral-400" />
                      Sarvam AI — Cloud STT & TTS
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Speaker: <strong className="text-neutral-200">{sarvamSpeaker}</strong> ({sarvamLanguageCode})
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">API Subscription Key</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showSarvamKey ? 'text' : 'password'}
                            value={sarvamKeyInput}
                            onChange={(e) => setSarvamKeyInput(e.target.value)}
                            placeholder="Paste your SARVAM_API_KEY..."
                            className="w-full px-3.5 py-2.5 pr-16 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSarvamKey(!showSarvamKey)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white transition"
                          >
                            {showSarvamKey ? 'Hide' : 'Show'}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSarvamApiKey(sarvamKeyInput);
                            diagnostics.runDiagnosis();
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
                        >
                          Save Key
                        </button>

                        <button
                          type="button"
                          disabled={isTestingSarvam || !sarvamKeyInput}
                          onClick={async () => {
                            setIsTestingSarvam(true);
                            setSarvamTestStatus('Synthesizing speech with Aarti...');
                            try {
                              const res = await fetch('https://api.sarvam.ai/text-to-speech', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'api-subscription-key': sarvamKeyInput.trim(),
                                },
                                body: JSON.stringify({
                                  text: 'नमस्ते! मैं पीहू हूँ। सर्वम एआई वॉइस इंजन सक्रिय है।',
                                  language_code: sarvamLanguageCode,
                                  speaker: sarvamSpeaker,
                                  model: 'bulbul:v4-flash',
                                }),
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}`);
                              const data = await res.json();
                              if (data.audios?.[0]) {
                                const audio = new Audio(`data:audio/wav;base64,${data.audios[0]}`);
                                await audio.play();
                                setSarvamTestStatus('✓ Playing Aarti sample audio!');
                              }
                            } catch (e: any) {
                              setSarvamTestStatus(`✗ Error: ${e.message}`);
                            } finally {
                              setIsTestingSarvam(false);
                              setTimeout(() => setSarvamTestStatus(null), 4000);
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-neutral-300" />
                          {isTestingSarvam ? 'Testing...' : 'Test Voice'}
                        </button>
                      </div>
                      {sarvamTestStatus && (
                        <p className="text-[11px] text-neutral-400 italic mt-1.5">{sarvamTestStatus}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Speaker Voice</label>
                        <select
                          value={sarvamSpeaker}
                          onChange={(e) => setSarvamSpeaker(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500 transition appearance-none"
                        >
                          <option value="aarti_hi_customer">Aarti (Hindi Customer)</option>
                          <option value="arvind">Arvind</option>
                          <option value="amol">Amol</option>
                          <option value="meera">Meera</option>
                          <option value="amartya">Amartya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Language Code</label>
                        <select
                          value={sarvamLanguageCode}
                          onChange={(e) => setSarvamLanguageCode(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500 transition appearance-none"
                        >
                          <option value="hi-IN">Hindi (hi-IN)</option>
                          <option value="en-IN">English India (en-IN)</option>
                          <option value="bn-IN">Bengali (bn-IN)</option>
                          <option value="ta-IN">Tamil (ta-IN)</option>
                          <option value="te-IN">Telugu (te-IN)</option>
                          <option value="kn-IN">Kannada (kn-IN)</option>
                          <option value="ml-IN">Malayalam (ml-IN)</option>
                          <option value="mr-IN">Marathi (mr-IN)</option>
                          <option value="gu-IN">Gujarati (gu-IN)</option>
                          <option value="od-IN">Odia (od-IN)</option>
                          <option value="pa-IN">Punjabi (pa-IN)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ElevenLabs Cloud Configuration ── */}
                <div className="p-5 rounded-2xl settings-frost-panel space-y-4">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                    ElevenLabs — High-Fidelity Cloud TTS
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">API Key</label>
                      <input
                        type="password"
                        placeholder="sk_..."
                        value={elevenLabsApiKey}
                        onChange={(e) => setElevenLabsConfig(e.target.value, elevenLabsVoiceId)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Voice Model ID</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="MmQVkVZnQ0dUbfWzcW6f"
                          value={elevenLabsVoiceId}
                          onChange={(e) => setElevenLabsConfig(elevenLabsApiKey, e.target.value)}
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/[0.12] backdrop-blur-lg border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500 transition"
                        />
                        <button
                          type="button"
                          disabled={isTestingElevenLabs || !elevenLabsApiKey}
                          onClick={async () => {
                            setIsTestingElevenLabs(true);
                            setElevenLabsTestStatus('Generating speech with ElevenLabs...');
                            try {
                              const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId.trim() || 'MmQVkVZnQ0dUbfWzcW6f'}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'xi-api-key': elevenLabsApiKey.trim(),
                                },
                                body: JSON.stringify({
                                  text: 'Hello! I am PIHU, your personal AI assistant. ElevenLabs voice engine is now active.',
                                  model_id: 'eleven_multilingual_v2',
                                  voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                                }),
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const audio = new Audio(url);
                              audio.onended = () => URL.revokeObjectURL(url);
                              await audio.play();
                              setElevenLabsTestStatus('✓ Playing ElevenLabs sample audio!');
                            } catch (e: any) {
                              setElevenLabsTestStatus(`✗ Error: ${e.message}`);
                            } finally {
                              setIsTestingElevenLabs(false);
                              setTimeout(() => setElevenLabsTestStatus(null), 5000);
                            }
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-neutral-300" />
                          {isTestingElevenLabs ? 'Testing...' : 'Test Voice'}
                        </button>
                      </div>
                      {elevenLabsTestStatus && (
                        <p className="text-[11px] text-neutral-400 italic mt-1.5">{elevenLabsTestStatus}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* ══════ SECTION 7: ENGINE DIAGNOSTICS ══════ */}
            {activeSidebarCategory === 'diagnostics' && (
              <div className="space-y-6">
                {/* Real AI Engine Diagnosis & Architecture Stack */}
                <div className="p-5 rounded-3xl settings-frost-panel space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-neutral-400" /> Live Engine Diagnostics
                    </h4>
                    <button
                      onClick={() => diagnostics.runDiagnosis()}
                      disabled={diagnostics.isDiagnosing}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${diagnostics.isDiagnosing ? 'animate-spin text-neutral-400' : 'text-neutral-400'}`} />
                      {diagnostics.isDiagnosing ? 'Diagnosing...' : 'Run Diagnosis'}
                    </button>
                  </div>

                  <EngineDiagnosticsSummary />

                  {/* Fallback & Diagnosis Alert Banner */}
                  {(diagnostics.stt.isFallback || diagnostics.tts.isFallback || diagnostics.stt.error || diagnostics.tts.error) && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                        <Sparkles className="w-3.5 h-3.5" /> Engine Diagnosis & Automatic Fallback Active
                      </div>
                      {diagnostics.stt.error && (
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          • <strong className="text-amber-100">STT:</strong> {diagnostics.stt.error}
                        </p>
                      )}
                      {diagnostics.tts.error && (
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          • <strong className="text-amber-100">TTS:</strong> {diagnostics.tts.error}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Engine Selection Controls */}
                  <div className="pt-2 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">STT Engine Preference</label>
                      <select
                        value={sttEnginePreference}
                        onChange={(e) => {
                          setSttEnginePreference(e.target.value as any);
                          setTimeout(() => diagnostics.runDiagnosis(), 100);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.12] border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500"
                      >
                        <option value="auto">Auto Fallback (Whisper → Sarvam → Gemini Live)</option>
                        <option value="whisper">Local Whisper.cpp Only (ws://5001)</option>
                        <option value="sarvam">Sarvam AI Cloud STT (Hindi/Hinglish)</option>
                        <option value="gemini_live">Gemini Live STT API (Cloud Only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5">TTS Engine Preference</label>
                      <select
                        value={ttsEnginePreference}
                        onChange={(e) => {
                          setTtsEnginePreference(e.target.value as any);
                          setTimeout(() => diagnostics.runDiagnosis(), 100);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.12] border border-white/10 text-xs text-white focus:outline-none focus:border-neutral-500"
                      >
                        <option value="auto">Auto Fallback (Kokoro → Sarvam AI → ElevenLabs → Native)</option>
                        <option value="kokoro">Local Kokoro Neural Synthesizer (Port 48126)</option>
                        <option value="sarvam">Sarvam AI (Aarti - Hindi/Hinglish - hi-IN)</option>
                        <option value="elevenlabs">ElevenLabs Multilingual (Cloud)</option>
                        <option value="native">macOS Native Speech (Web Speech API)</option>
                      </select>
                    </div>
                  </div>

                  {/* Sarvam AI Configuration Section */}
                  <div className="pt-3 border-t border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-neutral-400" /> Sarvam AI Cloud TTS Setup
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Speaker: <strong className="text-neutral-200">aarti_hi_customer</strong> (hi-IN)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showSarvamKey ? 'text' : 'password'}
                          value={sarvamKeyInput}
                          onChange={(e) => setSarvamKeyInput(e.target.value)}
                          placeholder="Paste your SARVAM_API_KEY..."
                          className="w-full px-3.5 py-2 pr-16 rounded-xl bg-black/[0.12] border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSarvamKey(!showSarvamKey)}
                          className="absolute right-2.5 top-2.5 text-[10px] text-neutral-400 hover:text-white"
                        >
                          {showSarvamKey ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSarvamApiKey(sarvamKeyInput);
                          diagnostics.runDiagnosis();
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
                      >
                        Save Key
                      </button>

                      <button
                        type="button"
                        disabled={isTestingSarvam || !sarvamKeyInput}
                        onClick={async () => {
                          setIsTestingSarvam(true);
                          setSarvamTestStatus('Synthesizing speech with Aarti...');
                          try {
                            const res = await fetch('https://api.sarvam.ai/text-to-speech', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'api-subscription-key': sarvamKeyInput.trim(),
                              },
                              body: JSON.stringify({
                                text: 'नमस्ते! मैं पीहू हूँ। सर्वम एआई वॉइस इंजन सक्रिय है।',
                                language_code: 'hi-IN',
                                speaker: 'aarti_hi_customer',
                                model: 'bulbul:v4-flash',
                              }),
                            });
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const data = await res.json();
                            if (data.audios?.[0]) {
                              const audio = new Audio(`data:audio/wav;base64,${data.audios[0]}`);
                              await audio.play();
                              setSarvamTestStatus('Playing Aarti sample audio!');
                            }
                          } catch (e: any) {
                            setSarvamTestStatus(`Error: ${e.message}`);
                          } finally {
                            setIsTestingSarvam(false);
                            setTimeout(() => setSarvamTestStatus(null), 4000);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-neutral-300" />
                        {isTestingSarvam ? 'Testing...' : 'Test Voice'}
                      </button>
                    </div>

                    {sarvamTestStatus && (
                      <p className="text-[11px] text-neutral-400 italic">{sarvamTestStatus}</p>
                    )}
                  </div>
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

                <div className="p-4 rounded-2xl settings-frost-panel flex items-center justify-between">
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
              <ShortcutSettings />
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
                  <div className="p-12 text-center rounded-3xl settings-frost-panel space-y-3">
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
                            className="p-4 rounded-2xl settings-frost-panel hover:border-neutral-500/30 transition duration-200 flex flex-col justify-between space-y-3 group shadow-lg"
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
              <div className="p-8 rounded-3xl settings-frost-panel space-y-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <img src={pihuLogo} alt="PIHU logo" className="w-20 h-20 object-contain" />
                  <div>
                    <h3 className="text-xl font-bold text-white">PIHU OS <span className="text-neutral-300">v{appVersion}</span></h3>
                    <p className="text-sm text-neutral-400 mt-1">Your personal AI desktop companion</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed max-w-3xl mx-auto text-center">
                  PIHU brings voice-powered assistance, desktop companions, and connected tools together in one workspace. Talk naturally, work across your projects, and connect services such as Google Workspace and Spotify through MCP integrations.
                </p>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/[0.12]">
                  <table className="w-full text-left text-sm">
                    <caption className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300 border-b border-white/10">Build information</caption>
                    <tbody className="divide-y divide-white/[0.07]">
                      {[
                        ['Product', 'PIHU OS'],
                        ['Version', appVersion],
                        ['Build number', __PIHU_BUILD_INFO__.number],
                        ['Build name', __PIHU_BUILD_INFO__.name],
                        ['Build date', new Date(__PIHU_BUILD_INFO__.date).toLocaleString()],
                        ...(developerMode ? [
                          ['Branch', __PIHU_BUILD_INFO__.branch],
                          ['Commit', __PIHU_BUILD_INFO__.commit],
                        ] : []),
                      ].map(([label, value]) => (
                        <tr key={label}>
                          <th scope="row" className="w-1/3 px-4 py-3 font-medium text-neutral-400">{label}</th>
                          <td className="px-4 py-3 text-neutral-200 font-mono text-xs break-all">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SoftwareUpdate />
                <p className="text-xs text-neutral-500 text-center">Created by Mayank Jha</p>
              </div>
            )}

            {activeSidebarCategory === 'spirits' && <SpiritsSettings />}

          </div>

        </div>

      </GlassCard>
      </motion.div>
    </motion.div>
  );
};
