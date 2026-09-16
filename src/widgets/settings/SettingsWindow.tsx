import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { Key, ShieldCheck, Cpu, Volume2, Plus, Trash2, RotateCcw, X, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

export const SettingsWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'voice' | 'diagnostics'>('tokens');
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
  } = useSettingsStore();

  const voiceStore = useVoiceStore();

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
