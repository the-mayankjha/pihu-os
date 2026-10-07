import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Command, X, Send, Sparkles, Mail, MessageSquare, 
  Inbox, Terminal, Code2, Settings, ArrowRight, Mic, 
  CheckCircle2, XCircle, FileCode, Cpu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useVoiceStore } from '../../../stores/voiceStore';
import { ActionEngine } from '../../../core/voice/intent/ActionEngine';
import { ThinkingOrb } from '../ThinkingOrb';
import { IdeCodeBlock } from '../../../core/voice/IdeCodeBlock';
import { EmailPreviewCard } from '../Email/EmailPreviewCard';
import { WhatsAppConfirmationCard } from '../WhatsApp/WhatsAppConfirmationCard';
import { executePendingProjectAction } from '../../../core/voice/intent/tools/projectTools';

interface ShortcutItem {
  id: string;
  icon: React.ReactNode;
  category: 'Email' | 'WhatsApp' | 'Coding' | 'System' | 'Settings';
  title: string;
  prompt: string;
  badge?: string;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    id: 'email-proposal',
    icon: <Mail className="w-4 h-4 text-cyan-400" />,
    category: 'Email',
    title: 'Send Proposal Accepted Email',
    prompt: 'Send a mail to Mayank that his proposal is accepted',
    badge: 'Draft & Preview',
  },
  {
    id: 'email-unread',
    icon: <Inbox className="w-4 h-4 text-blue-400" />,
    category: 'Email',
    title: 'Check Unread Emails',
    prompt: 'Check my unread emails in Gmail',
    badge: 'Gmail API',
  },
  {
    id: 'whatsapp-msg',
    icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
    category: 'WhatsApp',
    title: 'Send WhatsApp Message',
    prompt: 'Send WhatsApp message to Mom: I will be home soon',
    badge: 'Fuzzy Matching',
  },
  {
    id: 'whatsapp-recent',
    icon: <MessageSquare className="w-4 h-4 text-teal-400" />,
    category: 'WhatsApp',
    title: 'Recent WhatsApp Chats',
    prompt: 'Show recent WhatsApp messages',
    badge: 'Live Bridge',
  },
  {
    id: 'run-python',
    icon: <Terminal className="w-4 h-4 text-amber-400" />,
    category: 'Coding',
    title: 'Run Code Script',
    prompt: 'Run python script main.py',
    badge: 'Output Window',
  },
  {
    id: 'create-react',
    icon: <Code2 className="w-4 h-4 text-purple-400" />,
    category: 'Coding',
    title: 'Create React Project',
    prompt: 'Create a React dashboard project',
    badge: 'Agentic Scaffolding',
  },
  {
    id: 'settings-tokens',
    icon: <Settings className="w-4 h-4 text-indigo-400" />,
    category: 'Settings',
    title: 'Manage API Keys & Tokens',
    prompt: 'Open tokens and API keys settings',
    badge: 'Protocol',
  },
  {
    id: 'system-stats',
    icon: <Cpu className="w-4 h-4 text-rose-400" />,
    category: 'System',
    title: 'System Health & Battery',
    prompt: 'Check system battery and CPU status',
    badge: 'Monitor',
  },
];

export const CommandPalette: React.FC = () => {
  const { 
    isCommandPaletteOpen, 
    setIsCommandPaletteOpen, 
    pendingProjectAction, 
    pendingEmailAction,
    pendingWhatsAppAction,
    setPendingProjectAction,
    activeProject,
    setIsListening,
    isListening
  } = useVoiceStore();

  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isApplyingProject, setIsApplyingProject] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const actionEngineRef = useRef<ActionEngine | null>(null);
  if (!actionEngineRef.current) {
    actionEngineRef.current = new ActionEngine();
  }

  // Global Keyboard Listener for Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }

      // Close on Escape
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  const handleExecute = async (commandToRun?: string) => {
    const textToProcess = (commandToRun || query).trim();
    if (!textToProcess || isProcessing) return;

    setLastQuery(textToProcess);
    setQuery('');
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await actionEngineRef.current!.processIntent(textToProcess);
      setResult(response);
    } catch (err: any) {
      setResult(`Error executing command: ${err?.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShortcutClick = (shortcut: ShortcutItem) => {
    setQuery(shortcut.prompt);
    handleExecute(shortcut.prompt);
  };

  const handleApplyProjectChanges = async () => {
    setIsApplyingProject(true);
    try {
      const res = await executePendingProjectAction();
      if (res.success) {
        setResult(`Done Sir Mayank! Applied all staged changes for "${pendingProjectAction?.title}".`);
      }
    } catch (err) {
      console.error('Failed to apply staged changes:', err);
    } finally {
      setIsApplyingProject(false);
    }
  };

  const handleCancelProjectChanges = () => {
    setPendingProjectAction(null);
    setResult('Cancelled proposed project changes.');
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-md pointer-events-auto">
        {/* Backdrop click to close */}
        <div 
          className="absolute inset-0 -z-10" 
          onClick={() => setIsCommandPaletteOpen(false)} 
        />

        {/* Floating Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-3xl bg-slate-950/95 border border-white/20 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-white overflow-hidden backdrop-blur-2xl flex flex-col max-h-[85vh] relative"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/4 right-1/4 h-32 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-pink-500/20 blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 select-none bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>PIHU Command Center</span>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    AI Assistant
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                <Command className="w-3 h-3 text-slate-400" />
                <span>K</span>
              </div>
              <button
                onClick={() => setIsCommandPaletteOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Prompt Input Bar */}
          <div className="p-4 border-b border-white/10 bg-slate-900/50">
            <div className="relative flex items-center bg-slate-950/80 border border-white/15 rounded-2xl px-4 py-3 focus-within:border-purple-500/60 focus-within:shadow-[0_0_20px_rgba(168,85,247,0.25)] transition">
              <Search className="w-5 h-5 text-purple-400 mr-3 flex-shrink-0" />
              
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecute();
                  }
                }}
                placeholder="Ask PIHU or type a command (e.g. 'Send mail to Mayank', 'Run python script')..."
                className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none font-sans"
              />

              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 mr-2 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Voice toggle shortcut */}
              <button
                onClick={() => setIsListening(!isListening)}
                className={`p-1.5 rounded-xl border transition mr-2 cursor-pointer ${
                  isListening 
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title={isListening ? "Listening active" : "Speak via Voice"}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Submit Button */}
              <button
                onClick={() => handleExecute()}
                disabled={!query.trim() || isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                {isProcessing ? (
                  <ThinkingOrb state="thinking" size={14} />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Run</span>
              </button>
            </div>
          </div>

          {/* Scrollable Body: Shortcuts or Interactive Execution Results */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-white/20">

            {/* If Processing */}
            {isProcessing && (
              <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-center gap-3 text-purple-300 text-sm font-medium">
                <ThinkingOrb state="thinking" size={24} />
                <span>PIHU is processing: "{lastQuery}"...</span>
              </div>
            )}

            {/* ─── PENDING WHATSAPP MESSAGE CONFIRMATION CARD ─── */}
            {pendingWhatsAppAction && (
              <WhatsAppConfirmationCard className="mb-4" />
            )}

            {/* ─── PENDING EMAIL DRAFT & EDITABLE PREVIEW CARD ─── */}
            {pendingEmailAction && (
              <EmailPreviewCard />
            )}

            {/* ─── PENDING PROJECT / CODE MODIFICATION CONFIRMATION CARD ─── */}
            {pendingProjectAction && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-2xl">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 text-purple-300 font-medium text-sm">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>{pendingProjectAction.title}</span>
                  </div>
                  <span className="text-xs font-mono text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    {pendingProjectAction.files.length} file(s) staged
                  </span>
                </div>

                {/* File Tabs */}
                {pendingProjectAction.files.length > 1 && (
                  <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-thin">
                    {pendingProjectAction.files.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          selectedFileIndex === idx
                            ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileCode className="w-3 h-3 text-purple-400" />
                        <span className="truncate max-w-[150px]">{file.path.split('/').pop()}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Staged Code Viewer */}
                {pendingProjectAction.files[selectedFileIndex] && (
                  <IdeCodeBlock
                    filename={pendingProjectAction.files[selectedFileIndex].path}
                    language={pendingProjectAction.files[selectedFileIndex].language || 'tsx'}
                  >
                    {pendingProjectAction.files[selectedFileIndex].content}
                  </IdeCodeBlock>
                )}

                {/* Action Confirmation Buttons */}
                <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
                  <div className="text-[11px] text-slate-400 font-mono">
                    Awaiting confirmation to apply to disk.
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelProjectChanges}
                      disabled={isApplyingProject}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 transition cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Cancel</span>
                    </button>

                    <button
                      onClick={handleApplyProjectChanges}
                      disabled={isApplyingProject}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition cursor-pointer"
                    >
                      {isApplyingProject ? (
                        <ThinkingOrb state="thinking" size={14} />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isApplyingProject ? 'Applying...' : 'Apply Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Query Response Area */}
            {result && (
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-2">
                  <span className="font-mono text-purple-300">Prompt: "{lastQuery}"</span>
                  <button
                    onClick={() => setResult(null)}
                    className="text-slate-400 hover:text-white text-[11px] transition"
                  >
                    Clear Result
                  </button>
                </div>

                <div className="text-white/90 text-sm leading-relaxed max-h-[45vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({node, ...props}) => <p className="m-0 mb-2" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 my-2 text-slate-200" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 my-2 text-slate-200" {...props} />,
                      li: ({node, ...props}) => <li className="pl-0.5" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-base font-bold mt-3 mb-1 text-white" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-sm font-bold mt-3 mb-1 text-white" {...props} />,
                      code: ({node, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isMultiLine = String(children).includes('\n') || (match && match[1]);

                        if (isMultiLine) {
                          return (
                            <IdeCodeBlock language={match ? match[1] : 'text'}>
                              {String(children)}
                            </IdeCodeBlock>
                          );
                        }

                        return (
                          <code className="bg-white/10 rounded px-1.5 py-0.5 font-mono text-xs text-purple-300" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {result}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Quick Action Shortcuts Grid */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Quick Actions & Shortcuts
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Click to execute</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SHORTCUTS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleShortcutClick(item)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 transition group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {item.prompt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {item.badge && (
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer Bar */}
          <div className="px-5 py-2.5 bg-slate-950 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-4">
              <span><strong className="text-slate-400">Enter</strong> to Run</span>
              <span><strong className="text-slate-400">Esc</strong> to Close</span>
            </div>
            {activeProject && (
              <span className="truncate max-w-[250px] text-purple-400">Project: {activeProject.name}</span>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
