import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal, Layers } from 'lucide-react';

interface IdeCodeBlockProps {
  language?: string;
  filename?: string;
  children: string;
}

export const IdeCodeBlock: React.FC<IdeCodeBlockProps> = ({
  language = 'text',
  filename,
  children,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const rawCode = String(children || '').trimEnd();
  const lines = rawCode.split('\n');
  const isDiff = language.toLowerCase() === 'diff' || lines.some(l => l.startsWith('+ ') || l.startsWith('- '));
  const isLong = lines.length > 28;
  const displayedLines = isLong && !isExpanded ? lines.slice(0, 24) : lines;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy code:', err);
    }
  };

  const getLanguageLabel = () => {
    const lang = language.toLowerCase();
    if (lang === 'tsx' || lang === 'jsx') return 'React / TSX';
    if (lang === 'ts' || lang === 'typescript') return 'TypeScript';
    if (lang === 'js' || lang === 'javascript') return 'JavaScript';
    if (lang === 'py' || lang === 'python') return 'Python';
    if (lang === 'html') return 'HTML';
    if (lang === 'css') return 'CSS';
    if (lang === 'json') return 'JSON';
    if (lang === 'bash' || lang === 'sh' || lang === 'zsh') return 'Bash';
    if (lang === 'diff') return 'Git Diff';
    if (lang === 'rust') return 'Rust';
    if (lang === 'go') return 'Go';
    if (lang === 'java') return 'Java';
    return language.toUpperCase() || 'CODE';
  };

  // Basic syntax highlighter for token coloring
  const renderHighlightedLine = (line: string) => {
    if (isDiff) {
      if (line.startsWith('+')) {
        return <span className="text-emerald-300 font-mono font-medium">{line}</span>;
      }
      if (line.startsWith('-')) {
        return <span className="text-rose-300 font-mono opacity-80">{line}</span>;
      }
      if (line.startsWith('@@')) {
        return <span className="text-purple-400 font-mono font-semibold bg-purple-500/10 px-1 rounded">{line}</span>;
      }
    }

    // Comment
    if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*')) {
      return <span className="text-slate-500 italic font-mono">{line}</span>;
    }

    // Tokenizer regex for keywords, strings, tags, types
    const tokens = line.split(/(\b(?:import|export|from|const|let|var|function|return|interface|type|class|def|async|await|if|else|switch|case|break|try|catch|new|for|while|extends|implements|public|private|static|yield)\b|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z0-9_.-]+(?:\s+[^>]*)?>|\b(?:React|FC|useState|useEffect|useCallback|useMemo|useRef|useContext|string|number|boolean|any|void|null|undefined|true|false)\b)/g);

    return (
      <span className="font-mono">
        {tokens.map((token, i) => {
          if (!token) return null;

          // Keywords
          if (/^\b(?:import|export|from|const|let|var|function|return|interface|type|class|def|async|await|if|else|switch|case|break|try|catch|new|for|while|extends|implements|public|private|static|yield)\b$/.test(token)) {
            return <span key={i} className="text-purple-400 font-semibold">{token}</span>;
          }

          // Types & Hooks
          if (/^\b(?:React|FC|useState|useEffect|useCallback|useMemo|useRef|useContext|string|number|boolean|any|void|null|undefined|true|false)\b$/.test(token)) {
            return <span key={i} className="text-cyan-300 font-medium">{token}</span>;
          }

          // Strings
          if (/^(".*"|'.*'|`.*`)$/.test(token)) {
            return <span key={i} className="text-emerald-300">{token}</span>;
          }

          // JSX Tags
          if (/^<\/?[A-Za-z0-9_.-]+/.test(token)) {
            return <span key={i} className="text-sky-300">{token}</span>;
          }

          return <span key={i} className="text-slate-200">{token}</span>;
        })}
      </span>
    );
  };

  return (
    <div className="my-3 rounded-2xl border border-white/15 bg-slate-950/95 overflow-hidden shadow-2xl backdrop-blur-xl group select-text">
      {/* IDE Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-white/10 select-none">
        {/* macOS Traffic Lights + File / Language Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md">
            {isDiff ? (
              <Layers className="w-3 h-3 text-purple-400" />
            ) : language === 'bash' || language === 'sh' ? (
              <Terminal className="w-3 h-3 text-purple-400" />
            ) : (
              <FileCode className="w-3 h-3 text-purple-400" />
            )}
            <span className="font-semibold">{filename || getLanguageLabel()}</span>
          </div>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
            {lines.length} lines
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
          title="Copy full code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-[11px]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-mono">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Editor Body with Gutter */}
      <div className="relative overflow-x-auto p-3 text-xs leading-relaxed max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
        <div className="min-w-full table border-collapse">
          {displayedLines.map((line, idx) => {
            const lineNum = idx + 1;
            const isAdded = isDiff && line.startsWith('+');
            const isRemoved = isDiff && line.startsWith('-');

            return (
              <div
                key={idx}
                className={`table-row ${
                  isAdded
                    ? 'bg-emerald-950/40'
                    : isRemoved
                    ? 'bg-rose-950/40'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                {/* Gutter Line Number */}
                <div className="table-cell pr-3.5 py-0.5 text-right text-slate-600 font-mono text-[11px] select-none w-8 border-r border-white/5">
                  {lineNum}
                </div>

                {/* Code Content */}
                <div
                  className={`table-cell pl-3 py-0.5 font-mono whitespace-pre ${
                    isAdded
                      ? 'border-l border-emerald-500/80 text-emerald-300'
                      : isRemoved
                      ? 'border-l border-rose-500/80 text-rose-300'
                      : ''
                  }`}
                >
                  {renderHighlightedLine(line)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show More / Collapse Footer if Long */}
      {isLong && (
        <div className="flex items-center justify-center p-2 bg-slate-900/60 border-t border-white/5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-mono text-purple-400 hover:text-purple-300 underline cursor-pointer"
          >
            {isExpanded ? 'Collapse code preview ▲' : `Show all ${lines.length} lines ▼`}
          </button>
        </div>
      )}
    </div>
  );
};
