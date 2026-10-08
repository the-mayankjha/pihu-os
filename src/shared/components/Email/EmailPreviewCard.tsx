import React, { useState, useEffect } from 'react';
import { Mail, Send, XCircle, User, AlertCircle, Edit3 } from 'lucide-react';
import { useVoiceStore } from '../../../stores/voiceStore';
import type { PendingEmailAction } from '../../../stores/voiceStore';
import { executePendingEmailSend } from '../../../core/voice/intent/tools/googleWorkspaceTools';
import { ThinkingOrb } from '../ThinkingOrb';

interface EmailPreviewCardProps {
  email?: PendingEmailAction;
  onClose?: () => void;
  className?: string;
}

export const EmailPreviewCard: React.FC<EmailPreviewCardProps> = ({
  email: customEmail,
  onClose,
  className = '',
}) => {
  const { pendingEmailAction, updatePendingEmailAction, setPendingEmailAction, setResponse } = useVoiceStore();
  const currentEmail = customEmail || pendingEmailAction;

  const [to, setTo] = useState(currentEmail?.to || '');
  const [toEmail, setToEmail] = useState(currentEmail?.toEmail || '');
  const [subject, setSubject] = useState(currentEmail?.subject || '');
  const [body, setBody] = useState(currentEmail?.body || '');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentEmail) {
      setTo(currentEmail.to);
      setToEmail(currentEmail.toEmail);
      setSubject(currentEmail.subject);
      setBody(currentEmail.body);
    }
  }, [currentEmail]);

  if (!currentEmail) return null;

  const handleFieldChange = (field: 'to' | 'toEmail' | 'subject' | 'body', value: string) => {
    if (field === 'to') setTo(value);
    if (field === 'toEmail') setToEmail(value);
    if (field === 'subject') setSubject(value);
    if (field === 'body') setBody(value);

    updatePendingEmailAction({ [field]: value });
  };

  const handleSend = async () => {
    if (!toEmail && !to) {
      setError('Please provide a recipient email address.');
      return;
    }
    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const recipient = toEmail || to;
      const res = await executePendingEmailSend(recipient, subject, body);
      if (res.success) {
        setResponse(`Done Sir Mayank! Email successfully sent to ${to || recipient} with subject "${subject}".`);
        if (onClose) onClose();
      } else {
        setError(res.error || 'Failed to send email.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send email.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setPendingEmailAction(null);
    setResponse('Cancelled sending the email draft.');
    if (onClose) onClose();
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-neutral-900/95 border border-neutral-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all text-white ${className}`}>
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.06] backdrop-blur-xl    blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-500/20 border border-neutral-500/40 flex items-center justify-center text-neutral-300 shadow-inner">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Gmail Draft Preview</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Review & Edit
              </span>
            </h4>
            <p className="text-[11px] text-neutral-400">Review full email body below. You can edit before sending.</p>
          </div>
        </div>

        <button
          onClick={handleCancel}
          disabled={isSending}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-400 hover:bg-neutral-500/10 transition cursor-pointer"
          title="Cancel Draft"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-neutral-500/10 border border-neutral-500/30 text-neutral-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-neutral-400" />
            <span>
              {error.includes('401') || error.includes('credentials') || error.includes('token') || error.includes('OAuth')
                ? 'Google Account is not linked or the session expired. Please connect in Settings.'
                : error}
            </span>
          </div>
          {(error.includes('401') || error.includes('credentials') || error.includes('token') || error.includes('OAuth') || error.includes('Settings')) && (
            <button
              onClick={async () => {
                const { useSettingsStore } = await import('../../../stores/settingsStore');
                const { useLayoutStore } = await import('../../../core/layout/LayoutStore');
                useSettingsStore.getState().setActiveSidebarCategory('connections');
                const isOpen = useLayoutStore.getState().widgets['settings-window']?.isOpen;
                if (!isOpen) useLayoutStore.getState().toggleWidget('settings-window');
              }}
              className="px-2.5 py-1 rounded-lg bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-200 border border-neutral-500/40 text-[11px] font-medium transition cursor-pointer flex-shrink-0 self-start sm:self-auto"
            >
              Open Settings → Connections
            </button>
          )}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-3">
        {/* Recipient Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="text-xs font-mono text-neutral-400 flex items-center gap-1.5 w-16 flex-shrink-0">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span>To:</span>
          </span>
          <input
            type="text"
            value={toEmail || to}
            onChange={(e) => handleFieldChange('toEmail', e.target.value)}
            placeholder="recipient@example.com"
            disabled={isSending}
            className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none font-sans"
          />
          {to && to !== toEmail && (
            <span className="text-[11px] font-mono text-neutral-400 truncate max-w-[150px]">({to})</span>
          )}
        </div>

        {/* Subject Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <span className="text-xs font-mono text-neutral-400 flex items-center gap-1.5 w-16 flex-shrink-0">
            <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Subject:</span>
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => handleFieldChange('subject', e.target.value)}
            placeholder="Subject line..."
            disabled={isSending}
            className="flex-1 bg-transparent text-sm font-medium text-white placeholder-neutral-500 focus:outline-none"
          />
        </div>

        {/* Full Editable Body Field */}
        <div className="flex flex-col bg-black/15/70 border border-white/10 rounded-xl p-3 focus-within:border-neutral-500/50 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-neutral-400">Email Body:</span>
            <span className="text-[10px] text-neutral-500 font-mono">Editable</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => handleFieldChange('body', e.target.value)}
            placeholder="Write your email body here..."
            disabled={isSending}
            rows={5}
            className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none resize-y min-h-[90px] max-h-[220px] font-sans leading-relaxed scrollbar-thin scrollbar-thumb-white/20"
          />
        </div>
      </div>

      {/* Action Footer & Voice Hint */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
        <div className="text-[11px] text-neutral-400 font-mono text-center sm:text-left">
          Say <strong className="text-emerald-400">"Send it"</strong> or <strong className="text-emerald-400">"Bhej do"</strong> or click Send.
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={handleCancel}
            disabled={isSending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-medium border border-white/10 transition cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5 text-neutral-400" />
            <span>Cancel</span>
          </button>

          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-1.5 rounded-xl bg-white/[0.06] backdrop-blur-xl  via-indigo-600  hover: hover: text-white text-xs font-semibold shadow-lg shadow-neutral-950/50 transition cursor-pointer disabled:opacity-50"
          >
            {isSending ? (
              <>
                <ThinkingOrb state="thinking" size={14} />
                <span>Sending Email...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Mail</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
