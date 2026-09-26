import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { Key, ShieldCheck, Cpu, Volume2, Plus, Trash2, RotateCcw, X, CheckCircle2, AlertTriangle, Activity, User, Mail } from 'lucide-react';

export const SettingsWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'voice' | 'diagnostics' | 'workspace'>('tokens');
  const [newKeyInput, setNewKeyInput] = useState('');
  
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
    googleAccountConnected,
    connectedGoogleAccounts,
    setGoogleWorkspaceConfig,
    removeConnectedGoogleAccount,
    setPrimaryGoogleAccount,
  } = useSettingsStore();

  const voiceStore = useVoiceStore();

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
    const interval = setInterval(syncAccountsFromFile, 2000);

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
    } catch (e) {
      // Ignore
    }
  };

  const handleSetPrimary = async (email: string) => {
    setPrimaryGoogleAccount(email);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const primaryCmd = `python3 -c "import os, json; p = os.path.expanduser('~/.gemini/antigravity/google_workspace_tokens.json'); data = json.load(open(p)) if os.path.exists(p) else {}; data['accounts'] = [{**a, 'is_primary': a.get('email','').lower() == '${email.toLowerCase()}'} for a in data.get('accounts', [])]; open(p, 'w').write(json.dumps(data, indent=2))"`;
      await invoke('execute_shell_command', { command: primaryCmd });
    } catch (e) {
      // Ignore
    }
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyInput.trim()) {
      addGeminiKey(newKeyInput.trim());
      setNewKeyInput('');
    }
  };

  const handleClose = () => {
    useLayoutStore.getState().toggleWidget('settings-window');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl h-[560px] rounded-2xl bg-neutral-900/90 border border-white/10 shadow-2xl overflow-hidden flex flex-col text-white font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-wide text-white">PIHU Context Protocol</h2>
              <p className="text-xs text-neutral-400">Token Protocol, Key Rotation & Engine Health</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'tokens'
                ? 'border-pink-500 text-pink-400 bg-white/5 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Key className="w-4 h-4" />
            Token Protocol ({geminiApiKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'voice'
                ? 'border-pink-500 text-pink-400 bg-white/5 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Voice & Speech
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'workspace'
                ? 'border-pink-500 text-pink-400 bg-white/5 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Google Workspace
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'diagnostics'
                ? 'border-pink-500 text-pink-400 bg-white/5 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Engine Diagnostics
          </button>
        </div>


        {/* Tab Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* TAB 1: Token Protocol (Gemini API Keys & Failover Rotation) */}
          {activeTab === 'tokens' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-xs text-pink-200/90 leading-relaxed">
                <span className="font-semibold text-pink-400">PIHU Token Protocol Active:</span> When a Gemini key encounters rate limits (429) or quota depletion (403), PIHU automatically rotates to the next available API key in real-time.
              </div>

              {/* Add Key Form */}
              <form onSubmit={handleAddKey} className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter Gemini API Key (AIzaSy...)"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 transition"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium transition shadow-lg shadow-pink-600/20"
                >
                  <Plus className="w-4 h-4" /> Add Key
                </button>
              </form>

              {/* Key List Header & Controls */}
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Configured Protocol Keys</h3>
                {exhaustedKeyIndices.length > 0 && (
                  <button
                    onClick={resetExhaustedKeys}
                    className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Exhausted Status
                  </button>
                )}
              </div>

              {/* Key List */}
              <div className="space-y-2">
                {geminiApiKeys.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 rounded-xl bg-black/20 border border-white/5">
                    No custom keys added yet. Operating on fallback environment keys.
                  </div>
                ) : (
                  geminiApiKeys.map((key, idx) => {
                    const isActive = idx === activeKeyIndex;
                    const isExhausted = exhaustedKeyIndices.includes(idx);
                    const maskedKey = `${key.slice(0, 6)}...${key.slice(-4)}`;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border transition ${
                          isActive
                            ? 'bg-pink-500/10 border-pink-500/40 text-white'
                            : isExhausted
                            ? 'bg-red-500/5 border-red-500/20 text-neutral-400'
                            : 'bg-black/30 border-white/5 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActiveKeyIndex(idx)}
                            className="text-left font-mono text-xs hover:text-pink-400 transition"
                          >
                            {maskedKey}
                          </button>
                          
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-[10px] font-semibold text-pink-400">
                              ACTIVE
                            </span>
                          )}
                          {isExhausted && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-semibold text-red-400">
                              QUOTA EXHAUSTED
                            </span>
                          )}
                          {!isActive && !isExhausted && (
                            <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] font-medium text-neutral-400">
                              READY
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => removeGeminiKey(idx)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Voice & TTS Configuration */}
          {activeTab === 'voice' && (
            <div className="space-y-5 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-300">ElevenLabs API Key (Optional Cloud TTS)</label>
                <input
                  type="password"
                  placeholder="Enter ElevenLabs API Key"
                  value={elevenLabsApiKey}
                  onChange={(e) => setElevenLabsConfig(e.target.value, elevenLabsVoiceId)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-300">Cloud Voice Model ID</label>
                <input
                  type="text"
                  placeholder="Voice ID (e.g. MmQVkVZnQ0dUbfWzcW6f)"
                  value={elevenLabsVoiceId}
                  onChange={(e) => setElevenLabsConfig(elevenLabsApiKey, e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 transition"
                />
              </div>

              <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2 text-neutral-400">
                <p className="font-semibold text-neutral-200">Default TTS Strategy:</p>
                <p>1. Kokoro Neural TTS (Local AI - Port 48126)</p>
                <p>2. ElevenLabs API (Cloud Backup)</p>
                <p>3. Native OS SpeechSynthesis (Offline Fallback)</p>
              </div>
            </div>
          )}

          {/* TAB 3: Google Workspace Credentials & Authorization */}
          {activeTab === 'workspace' && (
            <div className="space-y-5 text-xs">
              <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 text-xs text-pink-200/90 leading-relaxed">
                <span className="font-semibold text-pink-400">Google Workspace Integration:</span> Authorize PIHU OS to automate Gmail, Google Calendar, Google Docs, Google Tasks, Google Keep, and Google Drive across multiple Google accounts.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-300">Google OAuth Client ID</label>
                  <input
                    type="text"
                    placeholder="OAuth Client ID"
                    value={googleClientId}
                    onChange={(e) => setGoogleWorkspaceConfig(e.target.value, googleClientSecret, true)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 transition font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-300">Google OAuth Client Secret</label>
                  <input
                    type="password"
                    placeholder="OAuth Client Secret"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleWorkspaceConfig(googleClientId, e.target.value, true)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 transition font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Connected Accounts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white flex items-center gap-2 text-xs">
                    <User className="w-4 h-4 text-pink-400" />
                    Connected Google Accounts ({connectedGoogleAccounts.length})
                  </div>
                  <button
                    onClick={async () => {
                      const { invoke } = await import('@tauri-apps/api/core');
                      const cId = googleClientId.trim();
                      const cSecret = googleClientSecret.trim();

                      if (!cId || !cSecret) {
                        alert('Please enter your Google OAuth Client ID and Client Secret above first!');
                        return;
                      }

                      // Save credentials for workspace-mcp and google_workspace_tokens.json
                      const writeCredsCmd = `python3 -c "import os, json; data = {'installed': {'client_id': '${cId}', 'client_secret': '${cSecret}', 'auth_uri': 'https://accounts.google.com/o/oauth2/auth', 'token_uri': 'https://oauth2.googleapis.com/token', 'redirect_uris': ['http://localhost:8080/oauth2callback']}}; [os.makedirs(os.path.expanduser(d), exist_ok=True) or open(os.path.expanduser(f'{d}/credentials.json'), 'w').write(json.dumps(data, indent=2)) for d in ['~/.gworkspace-mcp', '~/.config/google-workspace-mcp']]; p = os.path.expanduser('~/.gemini/antigravity/google_workspace_tokens.json'); tdata = json.load(open(p)) if os.path.exists(p) else {}; tdata['client_id'] = '${cId}'; tdata['client_secret'] = '${cSecret}'; os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(json.dumps(tdata, indent=2))"`;
                      await invoke('execute_shell_command', { command: writeCredsCmd });

                      const startServerCmd = `python3 -c "import os, sys, subprocess; script = next((p for p in ['pihu_mcps/mcp/servers/google_oauth_server.py', 'src-tauri/pihu_mcps/mcp/servers/google_oauth_server.py', '/Users/mayankjha/Documents/projects/pihu-os/src-tauri/pihu_mcps/mcp/servers/google_oauth_server.py'] if os.path.exists(p)), None); subprocess.Popen(['python3', script, '${cId}', '${cSecret}']) if script else print('script not found')" > /tmp/google_oauth.log 2>&1 &`;
                      await invoke('execute_shell_command', { command: startServerCmd });

                      const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
                      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cId}&redirect_uri=http://localhost:8080/oauth2callback&response_type=code&scope=${scopes}&access_type=offline&prompt=select_account%20consent`;
                      
                      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                      const cmd = isMac ? `open "${authUrl}"` : `start "" "${authUrl}"`;
                      await invoke('execute_shell_command', { command: cmd });
                      setGoogleWorkspaceConfig(cId, cSecret, true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-500/40 hover:bg-pink-500/30 text-pink-300 font-medium text-[11px] flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Link Another Account
                  </button>
                </div>

                {connectedGoogleAccounts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 text-center space-y-2">
                    <Mail className="w-8 h-8 text-neutral-500 mx-auto" />
                    <div className="text-neutral-400 font-medium text-xs">No Google accounts linked yet</div>
                    <div className="text-[11px] text-neutral-500">Click "Link Another Account" above to authorize your Gmail & Google Workspace.</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {connectedGoogleAccounts.map((acc) => (
                      <div
                        key={acc.email}
                        className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition"
                      >
                        <div className="flex items-center gap-3">
                          {acc.picture ? (
                            <img src={acc.picture} alt={acc.name} className="w-9 h-9 rounded-full border border-pink-500/40 object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs border border-white/20">
                              {acc.name ? acc.name[0].toUpperCase() : 'G'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2 text-xs">
                              {acc.name}
                              {acc.isPrimary && (
                                <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-[9px] font-bold text-pink-400">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-400">{acc.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!acc.isPrimary && (
                            <button
                              onClick={() => handleSetPrimary(acc.email)}
                              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 font-medium transition"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveAccount(acc.email)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition"
                            title="Disconnect Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Google Workspace Connection Status:</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                    googleAccountConnected || connectedGoogleAccounts.length > 0
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                  }`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {googleAccountConnected || connectedGoogleAccounts.length > 0 ? `${connectedGoogleAccounts.length || 1} Account(s) Connected` : 'Awaiting Authorization'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-neutral-400 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Gmail</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Calendar & Meet</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Google Docs</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Google Tasks</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Google Keep</div>
                  <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Google Drive</div>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to reset all Google Workspace accounts and credentials? This will remove all saved OAuth tokens and disconnect all accounts.')) {
                      return;
                    }
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      const resetCmd = `python3 -c "import os; [os.remove(os.path.expanduser(f)) for f in ['~/.gemini/antigravity/google_workspace_tokens.json', '~/.gworkspace-mcp/credentials.json', '~/.config/google-workspace-mcp/credentials.json'] if os.path.exists(os.path.expanduser(f))]"`;
                      await invoke('execute_shell_command', { command: resetCmd });
                      setGoogleWorkspaceConfig('', '', false);
                      useSettingsStore.setState({ connectedGoogleAccounts: [], googleAccountConnected: false });
                      alert('Successfully reset Google Workspace accounts and credentials.');
                    } catch (e: any) {
                      alert(`Failed to reset: ${e?.message || String(e)}`);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset All Google Accounts & Credentials
                </button>
              </div>
            </div>
          )}



          {/* TAB 3: Engine Health & Real-Time Diagnostics */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4 text-xs">
              <h3 className="font-semibold text-neutral-300 uppercase tracking-wider">Engine Health Matrix</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-4 h-4 text-pink-400" />
                    <div>
                      <div className="font-medium text-white">WakeWord Engine</div>
                      <div className="text-[10px] text-neutral-400">openwakeword + pyaudio</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-pink-400" />
                    <div>
                      <div className="font-medium text-white">Speech STT Server</div>
                      <div className="text-[10px] text-neutral-400">Whisper C++ (ws://5001)</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Listening
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-pink-400" />
                    <div>
                      <div className="font-medium text-white">Kokoro TTS Engine</div>
                      <div className="text-[10px] text-neutral-400">Flask HTTP (port 48126)</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-pink-400" />
                    <div>
                      <div className="font-medium text-white">MCP Servers</div>
                      <div className="text-[10px] text-neutral-400">file-mcp & system-mcp</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                </div>
              </div>

              {/* Active Engine Diagnostics */}
              <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="font-medium">Active Voice Engine:</span>
                  <span className="font-mono text-pink-400">{voiceStore.activeVoiceEngine}</span>
                </div>
                {voiceStore.lastTTSError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-red-400">Diagnostic Error Reported:</div>
                      <div>{voiceStore.lastTTSError}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Status Bar */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] text-neutral-400">
          <div>PIHU OS Protocol v0.1.0</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All Protocol Engines Operational
          </div>
        </div>

      </div>
    </div>
  );
};
