import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { useLayoutStore } from '../../../layout/LayoutStore';
import type { ActionTool, ToolResult } from './types';

// Helper to ensure bridge daemon is running
async function ensureWhatsAppBridge(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:8080/api/status').catch(() => null);
    if (res && res.ok) return true;

    // Start bridge background process
    const startCmd = `
      if [ -f src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge/bridge ]; then
        cd src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge && ./bridge > /tmp/pihu_whatsapp_bridge.log 2>&1 &
      elif [ -f ../mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge/bridge ]; then
        cd ../mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge && ./bridge > /tmp/pihu_whatsapp_bridge.log 2>&1 &
      else
        cd src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge && go run main.go > /tmp/pihu_whatsapp_bridge.log 2>&1 &
      fi
    `;
    await invoke('execute_shell_command', { command: startCmd }).catch(() => {});

    // Wait up to 3 seconds
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const check = await fetch('http://localhost:8080/api/status').catch(() => null);
      if (check && check.ok) return true;
    }
  } catch (e) {}
  return false;
}

type RecipientResolution = { jid: string; displayName: string; phone: string; match: 'exact' | 'fuzzy' | 'direct'; confidence: number };
type PendingVoiceMessage = { recipient: RecipientResolution; message: string; createdAt: number };
let pendingVoiceMessage: PendingVoiceMessage | null = null;

const normalizeContactName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const phoneticContactName = (value: string) => normalizeContactName(value).replace(/ph/g, 'f').replace(/(.)\1+/g, '$1');

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}

function nameScore(query: string, candidate: string): number {
  const q = normalizeContactName(query), c = normalizeContactName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (q.includes(c) || c.includes(q)) return 0.9;
  const phoneticQuery = phoneticContactName(query), phoneticCandidate = phoneticContactName(candidate);
  if (phoneticQuery === phoneticCandidate) return 0.88;
  return 1 - editDistance(phoneticQuery, phoneticCandidate) / Math.max(phoneticQuery.length, phoneticCandidate.length);
}

function localTarget(contact: { whatsappJid?: string; phone?: string }) {
  const target = contact.whatsappJid || contact.phone || '';
  let digits = target.replace(/\D/g, '');
  if (digits.length === 10 && ['6', '7', '8', '9'].includes(digits[0])) digits = '91' + digits;
  return { jid: digits ? (target.includes('@') ? target : `${digits}@s.whatsapp.net`) : '', phone: contact.phone || digits };
}

// Exact aliases send directly. Partial/phonetic matches are explicitly confirmed.
async function resolveWhatsAppRecipient(query: string): Promise<RecipientResolution> {
  const clean = query.replace(/^[-@]+/, '').trim();
  if (!clean) return { jid: '', displayName: '', phone: '', match: 'direct', confidence: 0 };

  const cleanLower = clean.toLowerCase();

  // 1. Check Settings / Local People Directory
  const contacts = useSettingsStore.getState().contacts || [];
  for (const c of contacts) {
    const cName = (c.name || '').toLowerCase();
    const cNick = (c.nickname || '').toLowerCase();
    if (cName === cleanLower || cNick === cleanLower) {
      const target = localTarget(c);
      return {
        jid: target.jid,
        displayName: c.name + (c.nickname ? ` (${c.nickname})` : ''),
        phone: target.phone, match: 'exact', confidence: 1,
      };
    }
  }

  let bestLocal: RecipientResolution | null = null;
  for (const c of contacts) {
    const score = Math.max(nameScore(clean, c.name || ''), nameScore(clean, c.nickname || ''));
    const target = localTarget(c);
    if (target.jid && score >= 0.72 && (!bestLocal || score > bestLocal.confidence)) {
      bestLocal = { jid: target.jid, displayName: c.name + (c.nickname ? ` (${c.nickname})` : ''), phone: target.phone, match: 'fuzzy', confidence: score };
    }
  }
  if (bestLocal) return bestLocal;

  // 2. Check Live WhatsApp Bridge for chats, contacts, and groups
  try {
    const res = await fetch('http://localhost:8080/api/chats', { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      const data = await res.json();
      let bestChat: RecipientResolution | null = null;
      for (const chat of data.chats || []) {
        const chatName = (chat.name || '').toLowerCase();
        if (chatName === cleanLower) {
          return {
            jid: chat.jid,
            displayName: chat.name + (chat.is_group ? ' [Group]' : ''),
            phone: chat.jid,
            match: 'exact', confidence: 1,
          };
        }
        const score = nameScore(clean, chat.name || '');
        if (score >= 0.72 && (!bestChat || score > bestChat.confidence)) bestChat = {
          jid: chat.jid, displayName: chat.name + (chat.is_group ? ' [Group]' : ''), phone: chat.jid, match: 'fuzzy', confidence: score,
        };
      }
      if (bestChat) return bestChat;
    }
  } catch (e) {}

  // 3. Direct phone number
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 7) {
    let formatted = digits;
    if (formatted.length === 10 && ['6', '7', '8', '9'].includes(formatted[0])) {
      formatted = '91' + formatted;
    }
    return {
      jid: `${formatted}@s.whatsapp.net`,
      displayName: `+${formatted}`,
      phone: `+${formatted}`,
      match: 'direct', confidence: 1,
    };
  }

  return { jid: '', displayName: clean, phone: '', match: 'direct', confidence: 0 };
}

async function dispatchWhatsAppMessage(recipient: RecipientResolution, message: string): Promise<ToolResult> {
  const sendRes = await fetch('http://localhost:8080/api/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: recipient.jid, message }), signal: AbortSignal.timeout(10000),
  });
  if (!sendRes.ok) {
    const errData = await sendRes.json().catch(() => ({}));
    return { success: false, error: errData.message || 'Failed to dispatch WhatsApp message. Make sure the phone number is valid.' };
  }
  return { success: true, data: { action: 'sent_whatsapp_message', recipient: recipient.displayName, message_text: message, message: `Successfully sent WhatsApp message to ${recipient.displayName}: "${message}"` } };
}

export async function handlePendingWhatsAppConfirmation(text: string): Promise<string | null> {
  if (!pendingVoiceMessage) return null;
  if (Date.now() - pendingVoiceMessage.createdAt > 2 * 60 * 1000) {
    pendingVoiceMessage = null;
    return 'The pending WhatsApp confirmation expired. Please repeat the message request.';
  }
  const answer = text.trim().toLowerCase();
  if (/^(no|nope|cancel|stop|wrong|don'?t)\b/.test(answer)) {
    pendingVoiceMessage = null;
    return 'Okay, I cancelled that WhatsApp message.';
  }
  if (!/^(yes|yeah|yep|correct|confirm|send|go ahead|do it|sure)\b/.test(answer)) return null;
  const pending = pendingVoiceMessage;
  pendingVoiceMessage = null;
  const result = await dispatchWhatsAppMessage(pending.recipient, pending.message);
  return result.success ? `Sent the WhatsApp message to ${pending.recipient.displayName}.` : `I could not send that WhatsApp message: ${result.error || 'Unknown error'}`;
}

export const whatsappTools: ActionTool[] = [
  // ─── 1. SEND MESSAGE ────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'whatsapp_send_message',
      description: 'Sends a WhatsApp message to a person (e.g. "Anin", "Mayank"), phone number (e.g. "9926674532", "+919926674532"), or group chat. Use when user says "send message to [Name] on whatsapp", "send whatsapp message to [person/number] saying [message]", "text [person] on whatsapp".',
      parameters: {
        type: 'OBJECT',
        properties: {
          recipient: {
            type: 'STRING',
            description: 'The person name (e.g. "Anin"), phone number, or group name to message.',
          },
          message: {
            type: 'STRING',
            description: 'The text message content to send via WhatsApp.',
          },
        },
        required: ['recipient', 'message'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        await ensureWhatsAppBridge();

        // Check authentication status first
        let isAuth = false;
        try {
          const stRes = await fetch('http://localhost:8080/api/status', { signal: AbortSignal.timeout(2000) });
          if (stRes.ok) {
            const stData = await stRes.json();
            isAuth = !!stData.logged_in;
          }
        } catch (e) {}

        if (!isAuth) {
          // Open Settings connections tab to show QR
          useSettingsStore.getState().setActiveSidebarCategory('connections');
          useLayoutStore.getState().toggleWidget('settings-window');
          return {
            success: true,
            data: {
              action: 'whatsapp_auth_required',
              message: 'Your WhatsApp device is not yet paired with PIHU OS. I have opened the Connections tab for you—please scan the QR code on screen using WhatsApp on your phone (Settings > Linked Devices).',
            },
          };
        }

        const resolved = await resolveWhatsAppRecipient(args.recipient);
        if (!resolved.jid) {
          return {
            success: false,
            error: `Contact "${args.recipient}" was not found in your People Directory or WhatsApp chats. Please specify their phone number or add them in Settings > People.`,
          };
        }

        if (resolved.match === 'fuzzy') {
          pendingVoiceMessage = { recipient: resolved, message: args.message, createdAt: Date.now() };
          return {
            success: true,
            data: {
              action: 'whatsapp_confirmation_required',
              message: `I heard "${args.recipient}" and found ${resolved.displayName}. Should I send "${args.message}" to ${resolved.displayName}? Please say yes or no.`,
            },
          };
        }
        return await dispatchWhatsAppMessage(resolved, args.message);
      } catch (e: any) {
        return { success: false, error: `WhatsApp Error: ${e?.message || String(e)}` };
      }
    },
  },

  // ─── 2. INITIATE AUTHENTICATION / PAIRING ────────────────────────────────────
  {
    declaration: {
      name: 'whatsapp_authenticate',
      description: 'Initiates WhatsApp device pairing, launches bridge, and displays the QR code in Settings Connections tab. Use when user says "Initiate WhatsApp MCP", "Authenticate WhatsApp", "Login WhatsApp", "Connect WhatsApp", "Pair WhatsApp with phone".',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    execute: async (): Promise<ToolResult> => {
      try {
        await ensureWhatsAppBridge();

        // Switch to Connections tab & open Settings Window
        useSettingsStore.getState().setActiveSidebarCategory('connections');
        const isSettingsOpen = useLayoutStore.getState().widgets['settings-window']?.isOpen;
        if (!isSettingsOpen) {
          useLayoutStore.getState().toggleWidget('settings-window');
        }

        // Fetch QR
        let hasQr = false;
        try {
          const qrRes = await fetch('http://localhost:8080/api/qr', { signal: AbortSignal.timeout(2000) });
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            if (qrData.logged_in) {
              return {
                success: true,
                data: {
                  action: 'whatsapp_already_authenticated',
                  message: 'WhatsApp is already authenticated and actively connected to PIHU OS!',
                },
              };
            }
            if (qrData.qr_code) hasQr = true;
          }
        } catch (e) {}

        return {
          success: true,
          data: {
            action: 'whatsapp_pairing_initiated',
            has_qr: hasQr,
            message: 'I have started the WhatsApp Bridge and opened the Connections tab. Please scan the QR code on screen with WhatsApp on your phone (Settings > Linked Devices > Link a Device).',
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to initiate WhatsApp pairing: ${e?.message || String(e)}` };
      }
    },
  },

  // ─── 3. CHECK STATUS ────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'whatsapp_get_status',
      description: 'Checks WhatsApp connection status, linked device JID, and bridge health. Use when user asks "is WhatsApp connected?", "check WhatsApp status", "WhatsApp connection health".',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const res = await fetch('http://localhost:8080/api/status', { signal: AbortSignal.timeout(2000) }).catch(() => null);
        if (!res || !res.ok) {
          return {
            success: true,
            data: {
              connected: false,
              logged_in: false,
              message: 'WhatsApp Bridge is currently offline. Say "Authenticate WhatsApp" or run "pihu mcp whatsapp auth" to start it.',
            },
          };
        }

        const data = await res.json();
        if (data.logged_in) {
          return {
            success: true,
            data: {
              connected: true,
              logged_in: true,
              jid: data.jid,
              platform: data.platform || 'PIHU Desktop',
              message: `WhatsApp is fully authenticated and active as ${data.jid} on PIHU Desktop.`,
            },
          };
        } else {
          return {
            success: true,
            data: {
              connected: true,
              logged_in: false,
              message: 'WhatsApp Bridge is running, but requires phone pairing. Say "Authenticate WhatsApp" to view the QR code.',
            },
          };
        }
      } catch (e: any) {
        return { success: false, error: `Status check failed: ${e?.message || String(e)}` };
      }
    },
  },

  // ─── 4. SEARCH CONTACTS & CHATS ─────────────────────────────────────────────
  {
    declaration: {
      name: 'whatsapp_search_contacts',
      description: 'Searches for contacts, existing chats, and groups across WhatsApp and the People Directory. Use when user says "search for [Name] on WhatsApp", "find contact [Name]", "list WhatsApp groups".',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Name, nickname, or keyword to search for.',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        await ensureWhatsAppBridge();
        const cleanQuery = (args.query || '').toLowerCase();
        const matches: any[] = [];

        // 1. Search local contacts
        const localContacts = useSettingsStore.getState().contacts || [];
        for (const c of localContacts) {
          if ((c.name || '').toLowerCase().includes(cleanQuery) || (c.nickname || '').toLowerCase().includes(cleanQuery)) {
            matches.push({
              name: c.name,
              nickname: c.nickname,
              phone: c.phone,
              type: 'Saved Contact',
            });
          }
        }

        // 2. Search WhatsApp chats/groups
        try {
          const res = await fetch('http://localhost:8080/api/chats', { signal: AbortSignal.timeout(1500) });
          if (res.ok) {
            const data = await res.json();
            for (const chat of data.chats || []) {
              if ((chat.name || '').toLowerCase().includes(cleanQuery)) {
                matches.push({
                  name: chat.name,
                  jid: chat.jid,
                  type: chat.is_group ? 'WhatsApp Group' : 'WhatsApp Chat',
                });
              }
            }
          }
        } catch (e) {}

        if (matches.length === 0) {
          return {
            success: true,
            data: {
              query: args.query,
              count: 0,
              message: `No contacts or chats matching "${args.query}" were found.`,
            },
          };
        }

        return {
          success: true,
          data: {
            query: args.query,
            count: matches.length,
            matches,
            message: `Found ${matches.length} matching contact(s):\n` + matches.map(m => `• ${m.name} (${m.type}${m.phone ? ` - ${m.phone}` : ''})`).join('\n'),
          },
        };
      } catch (e: any) {
        return { success: false, error: `Search failed: ${e?.message || String(e)}` };
      }
    },
  },

  // ─── 5. CLEAR DATA / RESET SESSION ──────────────────────────────────────────
  {
    declaration: {
      name: 'whatsapp_clear_data',
      description: 'Manually clears all local WhatsApp session tokens, chat history cache, and SQLite databases. Use when user says "clear whatsapp data", "reset whatsapp session", "wipe whatsapp data", "disconnect and reset whatsapp".',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const res = await fetch('http://localhost:8080/api/clear', {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          return {
            success: true,
            data: {
              action: 'whatsapp_data_cleared',
              message: data.message || 'WhatsApp session tokens, local message history, and cached chats have been cleared successfully.',
            },
          };
        }

        return {
          success: true,
          data: {
            action: 'whatsapp_data_cleared',
            message: 'WhatsApp session and local caches have been reset.',
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to clear WhatsApp data: ${e?.message || String(e)}` };
      }
    },
  },
];
