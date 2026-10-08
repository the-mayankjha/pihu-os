import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, XCircle, User, AlertCircle } from 'lucide-react';
import { useVoiceStore } from '../../../stores/voiceStore';
import type { PendingWhatsAppAction } from '../../../stores/voiceStore';
import { executePendingWhatsAppSend } from '../../../core/voice/intent/tools/whatsappTools';
import { ThinkingOrb } from '../ThinkingOrb';

interface WhatsAppConfirmationCardProps {
  action?: PendingWhatsAppAction;
  onClose?: () => void;
  className?: string;
}

export const WhatsAppConfirmationCard: React.FC<WhatsAppConfirmationCardProps> = ({
  action: customAction,
  onClose,
  className = '',
}) => {
  const { pendingWhatsAppAction, updatePendingWhatsAppAction, setPendingWhatsAppAction, setResponse } = useVoiceStore();
  const currentAction = customAction || pendingWhatsAppAction;

  const [recipientName, setRecipientName] = useState(currentAction?.recipient?.displayName || '');
  const [phone, setPhone] = useState(currentAction?.recipient?.phone || '');
  const [message, setMessage] = useState(currentAction?.message || '');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentAction) {
      setRecipientName(currentAction.recipient.displayName);
      setPhone(currentAction.recipient.phone);
      setMessage(currentAction.message);
    }
  }, [currentAction]);

  if (!currentAction) return null;

  const handleMessageChange = (val: string) => {
    setMessage(val);
    updatePendingWhatsAppAction({ message: val });
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Message text cannot be empty.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await executePendingWhatsAppSend(message);
      if (res.success) {
        setResponse(`Done Sir Mayank! Sent WhatsApp message to ${recipientName}: "${message}".`);
        if (onClose) onClose();
      } else {
        setError(res.error || 'Failed to send WhatsApp message.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send WhatsApp message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setPendingWhatsAppAction(null);
    setResponse('Cancelled sending WhatsApp message.');
    if (onClose) onClose();
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-neutral-900/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all text-white ${className}`}>
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.06] backdrop-blur-xl from-emerald-600/15 via-teal-500/10  blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-inner">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>WhatsApp Message Confirmation</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Review & Confirm
              </span>
            </h4>
            <p className="text-[11px] text-neutral-400">Review recipient and message before sending.</p>
          </div>
        </div>

        <button
          onClick={handleCancel}
          disabled={isSending}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-400 hover:bg-neutral-500/10 transition cursor-pointer"
          title="Cancel Message"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-xl bg-neutral-500/10 border border-neutral-500/30 text-neutral-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-neutral-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Recipient info */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5">
          <User className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-200 truncate">
              {recipientName}
            </span>
            {phone && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {phone}
              </span>
            )}
          </div>
        </div>

        {/* Message Input Area */}
        <div className="flex flex-col bg-black/15/70 border border-white/10 rounded-xl p-3 focus-within:border-emerald-500/50 transition">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-neutral-400">Message Text:</span>
            <span className="text-[10px] text-neutral-500 font-mono">Editable</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            placeholder="Type WhatsApp message..."
            disabled={isSending}
            rows={3}
            className="w-full bg-transparent text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none resize-none font-sans leading-relaxed scrollbar-thin scrollbar-thumb-white/20"
          />
        </div>
      </div>

      {/* Action Footer & Voice Hint */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
        <div className="text-[11px] text-neutral-400 font-mono text-center sm:text-left">
          Say <strong className="text-emerald-400">"Send it"</strong>, <strong className="text-emerald-400">"Yes"</strong> or click Send.
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-1.5 rounded-xl bg-white/[0.06] backdrop-blur-xl from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
          >
            {isSending ? (
              <>
                <ThinkingOrb state="thinking" size={14} />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
