import { invoke } from '@tauri-apps/api/core';
import { WHATSAPP_API_URL } from './whatsappBridge';
import { runGoogleApiClient } from '../voice/intent/tools/googleWorkspaceTools';
import { useSettingsStore } from '../../stores/settingsStore';

export interface IncomingMessage { id: string; sender: string; body?: string; subject?: string; timestamp?: number; media?: string }
export interface MessageAlert { service: 'whatsapp' | 'gmail'; messages: IncomingMessage[]; createdAt: number }

export function alertPrompt(alert: MessageAlert): string {
  const names = [...new Set(alert.messages.map(m => m.sender.replace(/\s*<[^>]+>/g, '').trim()))];
  if (alert.service === 'gmail') return `You got ${alert.messages.length === 1 ? 'a new email' : `${alert.messages.length} new emails`} from ${names.join(', ')}. Do you want me to read ${alert.messages.length === 1 ? 'it' : 'them'}?`;
  if (alert.messages.length === 1) return `You got a WhatsApp message from ${names[0]}. Do you want me to read it?`;
  return `You got ${alert.messages.length} new messages on WhatsApp from ${names.join(', ')}. Do you want to open WhatsApp? You can also ask me to read them.`;
}

export function notificationAnswer(text: string, alert: MessageAlert): 'read' | 'open' | 'dismiss' | null {
  const answer = text.trim().replace(/[.!?]+$/, '').toLowerCase();
  if (/\b(?:read|read out|read aloud)\b/.test(answer)) return 'read';
  if (/^(?:open|yes.*open)\b/.test(answer)) return 'open';
  if (/^(?:yes|yeah|yep|sure|okay|ok|please|haan)(?:\s+(?:please|do|do it))?$/.test(answer)) return alert.service === 'whatsapp' && alert.messages.length > 1 ? 'open' : 'read';
  if (/^(?:no|nope|not now|dismiss|cancel|stop)(?:\s+thanks)?$/.test(answer)) return 'dismiss';
  return null;
}

class MessageNotifications {
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private since = Date.now();
  private gmailStarted = false;
  private seen = new Set<string>();
  private queue: MessageAlert[] = [];
  private pending: MessageAlert | null = null;

  start(deliver: (prompt: string) => Promise<boolean>) {
    if (this.timer) return;
    const tick = async () => {
      if (this.polling) return;
      this.polling = true;
      try {
        if (!useSettingsStore.getState().messageVoiceAlerts || useSettingsStore.getState().focusModeActive) { this.since = Date.now(); this.gmailStarted = false; this.queue = []; this.pending = null; return; }
        await Promise.allSettled([this.pollWhatsApp(), this.pollGmail()]);
        if (this.pending && Date.now() - this.pending.createdAt > 5 * 60_000) this.pending = null;
        if (!this.pending && this.queue.length) {
          const next = this.queue[0];
          this.pending = { ...next, createdAt: Date.now() };
          if (await deliver(alertPrompt(next))) this.queue.shift();
          else this.pending = null;
        }
      } finally { this.polling = false; }
    };
    this.timer = setInterval(() => void tick().catch(() => {}), 15000);
    void tick().catch(() => {});
  }

  private enqueue(service: MessageAlert['service'], messages: IncomingMessage[]) {
    const fresh = messages.filter(m => !this.seen.has(`${service}:${m.id}`));
    for (const m of fresh) this.seen.add(`${service}:${m.id}`);
    if (fresh.length) {
      const queued = this.queue.find(a => a.service === service);
      if (queued) queued.messages.push(...fresh);
      else this.queue.push({ service, messages: fresh, createdAt: Date.now() });
    }
  }

  private async pollWhatsApp() {
    const res = await fetch(`${WHATSAPP_API_URL}/notifications?since=${this.since}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const messages: IncomingMessage[] = (await res.json()).messages || [];
    this.enqueue('whatsapp', messages);
    if (messages.length) this.since = Math.max(this.since, ...messages.map(m => m.timestamp || this.since)) - 1;
  }

  private async pollGmail() {
    const settings = useSettingsStore.getState();
    if (!settings.googleAccountConnected && !settings.connectedGoogleAccounts.length) { this.gmailStarted = false; return; }
    const res = await runGoogleApiClient('search_gmail', 'is:unread in:inbox newer_than:1d', '30');
    if (res.error || !Array.isArray(res.messages)) return;
    const messages: IncomingMessage[] = res.messages;
    if (!this.gmailStarted) {
      for (const m of messages) this.seen.add(`gmail:${m.id}`);
      this.gmailStarted = true;
    } else this.enqueue('gmail', messages);
  }

  get awaitingReply() { return this.pending !== null; }

  async respond(text: string): Promise<string | null> {
    const alert = this.pending;
    if (!alert || Date.now() - alert.createdAt > 5 * 60_000) { this.pending = null; return null; }
    const action = notificationAnswer(text, alert);
    if (!action) { this.pending = null; return null; }
    if (action === 'dismiss') return 'Okay. You can still ask me to read those messages.';
    if (action === 'open') {
      await invoke('execute_shell_command', { command: alert.service === 'whatsapp' ? 'open -a WhatsApp || open https://web.whatsapp.com' : 'open https://mail.google.com/mail/' });
      this.pending = null;
      return `Opened ${alert.service === 'whatsapp' ? 'WhatsApp' : 'Gmail'}.`;
    }
    const lines: string[] = [];
    for (const m of alert.messages) {
      if (alert.service === 'gmail') {
        const res = await runGoogleApiClient('read_gmail', m.id);
        if (res.error) return 'I could not read that email right now. Please try again.';
        lines.push(`Email from ${m.sender}. Subject: ${m.subject || 'No subject'}. ${res.body}`);
      } else lines.push(`Message from ${m.sender}: ${m.body || `An attachment${m.media ? ` (${m.media})` : ''}.`}`);
    }
    this.pending = null;
    return lines.join('\n\n');
  }
}
export const messageNotifications = new MessageNotifications();
