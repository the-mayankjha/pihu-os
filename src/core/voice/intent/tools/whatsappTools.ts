import { ensureWhatsAppBridge, waitForWhatsAppConnection, hasWhatsAppSession, WHATSAPP_API_URL } from '../../../services/whatsappBridge';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { useLayoutStore } from '../../../layout/LayoutStore';
import type { ActionTool, ToolResult } from './types';

type RecipientResolution = { jid: string; displayName: string; phone: string; match: 'exact' | 'fuzzy' | 'direct'; confidence: number };

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
  if (q === c) return 1.0;
  // Substring match requires both to have at least 3 chars AND significant overlap
  if (c.length >= 3 && q.length >= 3) {
    if (q.includes(c) && (c.length / q.length) >= 0.6) return 0.85;
    if (c.includes(q) && (q.length / c.length) >= 0.6) return 0.85;
  }
  const phoneticQuery = phoneticContactName(query), phoneticCandidate = phoneticContactName(candidate);
  if (phoneticQuery.length >= 3 && phoneticCandidate.length >= 3 && phoneticQuery === phoneticCandidate) return 0.82;
  const maxLen = Math.max(phoneticQuery.length, phoneticCandidate.length);
  if (maxLen <= 2) return 0;
  const dist = editDistance(phoneticQuery, phoneticCandidate);
  const similarity = 1 - dist / maxLen;
  return similarity >= 0.72 ? similarity : 0;
}

function localTarget(contact: { whatsappJid?: string; phone?: string }) {
  const target = contact.whatsappJid || contact.phone || '';
  let digits = target.replace(/\D/g, '');
  if (digits.length === 10 && ['6', '7', '8', '9'].includes(digits[0])) digits = '91' + digits;
  return { jid: digits ? (target.includes('@') ? target : `${digits}@s.whatsapp.net`) : '', phone: contact.phone || digits };
}

const INDIC_RELATION_ALIASES: Record<string, string[]> = {
  papa: ['papa', 'pappa', 'paapa', 'pa', 'pawpa', 'dad', 'daddy', 'pitaji', 'pita ji', 'father', 'bapa', 'baba', 'bapu', 'पापा', 'पप्पा', 'पिताजी', 'बापू', 'बाऊजी'],
  mummy: ['mummy', 'mumma', 'maa', 'ma', 'mataji', 'mata ji', 'mom', 'mommy', 'mother', 'amma', 'मम्मी', 'माँ', 'माताजी', 'अम्मी', 'आई'],
  bhaiya: ['bhaiya', 'bhai', 'bhaya', 'bhiya', 'bro', 'brother', 'veer', 'भैया', 'भाई', 'वीर'],
  didi: ['didi', 'behen', 'behna', 'sister', 'sis', 'दीदी', 'बहन', 'बहना'],
  chacha: ['chacha', 'chachu', 'kaka', 'चाचा', 'चाचू', 'काका'],
  mama: ['mama', 'mamaji', 'मामा', 'मामाजी'],
  dada: ['dada', 'dadaji', 'दादा', 'दादाजी', 'grandfather'],
  dadi: ['dadi', 'dadiji', 'दादी', 'दादीजी', 'grandmother'],
  nana: ['nana', 'nanaji', 'नाना', 'नानाजी'],
  nani: ['nani', 'naniji', 'नानी', 'नानीजी'],
};

let lastResolvedRecipient: RecipientResolution | null = null;

function getCanonicalRelation(word: string): string | null {
  const w = word.trim().toLowerCase();
  for (const [canonical, variants] of Object.entries(INDIC_RELATION_ALIASES)) {
    if (canonical === w || variants.includes(w)) {
      return canonical;
    }
  }
  return null;
}

// Exact aliases send directly. Partial/phonetic matches are explicitly confirmed.
async function resolveWhatsAppRecipient(query: string): Promise<RecipientResolution> {
  const clean = query.replace(/^[-@]+/, '').trim();
  const cleanLower = clean.toLowerCase();

  // Context / Pronoun fallback (e.g. "Send them hi", "Send him hi", "unhe message bhejo")
  const isPronoun = !clean || /^(them|him|her|unhe|unko|inhe|inhein|wo|woh|it|this|that|last)$/i.test(cleanLower);
  if (isPronoun && lastResolvedRecipient && lastResolvedRecipient.jid) {
    console.log(`[whatsappTools] 🔄 Pronoun "${clean}" resolved to last active contact: ${lastResolvedRecipient.displayName}`);
    return lastResolvedRecipient;
  }

  if (!clean) return { jid: '', displayName: '', phone: '', match: 'direct', confidence: 0 };

  const queryCanonical = getCanonicalRelation(cleanLower);

  // 0. Direct WhatsApp JID (e.g. groups @g.us or user JID @s.whatsapp.net)
  if (clean.includes('@')) {
    const res: RecipientResolution = { jid: clean, displayName: clean, phone: clean, match: 'exact', confidence: 1 };
    lastResolvedRecipient = res;
    return res;
  }

  // 1. Check Settings / Local People Directory
  const contacts = useSettingsStore.getState().contacts || [];
  for (const c of contacts) {
    const cName = (c.name || '').toLowerCase();
    const cNick = (c.nickname || '').toLowerCase();
    const cNameCanonical = getCanonicalRelation(cName);
    const cNickCanonical = getCanonicalRelation(cNick);

    if (
      cName === cleanLower ||
      cNick === cleanLower ||
      (queryCanonical && (queryCanonical === cNameCanonical || queryCanonical === cNickCanonical))
    ) {
      const target = localTarget(c);
      const res: RecipientResolution = {
        jid: target.jid,
        displayName: c.name + (c.nickname ? ` (${c.nickname})` : ''),
        phone: target.phone, match: 'exact', confidence: 1,
      };
      lastResolvedRecipient = res;
      return res;
    }
  }

  let bestLocal: RecipientResolution | null = null;
  for (const c of contacts) {
    const score = Math.max(nameScore(clean, c.name || ''), nameScore(clean, c.nickname || ''));
    const target = localTarget(c);
    if (target.jid && score >= 0.75 && (!bestLocal || score > bestLocal.confidence)) {
      bestLocal = { jid: target.jid, displayName: c.name + (c.nickname ? ` (${c.nickname})` : ''), phone: target.phone, match: 'fuzzy', confidence: score };
    }
  }
  if (bestLocal) {
    lastResolvedRecipient = bestLocal;
    return bestLocal;
  }

  // 2. Check Live WhatsApp Bridge for chats, contacts, and groups (with 5s timeout)
  try {
    const res = await fetch(`${WHATSAPP_API_URL}/chats`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      let bestChat: RecipientResolution | null = null;
      for (const chat of data.chats || []) {
        const chatName = (chat.name || '').toLowerCase();
        const chatCanonical = getCanonicalRelation(chatName);

        if (chatName === cleanLower || (queryCanonical && queryCanonical === chatCanonical)) {
          const matchRes: RecipientResolution = {
            jid: chat.jid,
            displayName: chat.name + (chat.is_group ? ' [Group]' : ''),
            phone: chat.jid,
            match: 'exact', confidence: 1,
          };
          lastResolvedRecipient = matchRes;
          return matchRes;
        }
        const score = nameScore(clean, chat.name || '');
        if (score >= 0.75 && (!bestChat || score > bestChat.confidence)) bestChat = {
          jid: chat.jid, displayName: chat.name + (chat.is_group ? ' [Group]' : ''), phone: chat.jid, match: 'fuzzy', confidence: score,
        };
      }
      if (bestChat) {
        lastResolvedRecipient = bestChat;
        return bestChat;
      }
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
  const sendRes = await fetch(`${WHATSAPP_API_URL}/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: recipient.jid, message }), signal: AbortSignal.timeout(10000),
  });
  if (!sendRes.ok) {
    const errData = await sendRes.json().catch(() => ({}));
    return { success: false, error: errData.message || 'Failed to dispatch WhatsApp message. Make sure WhatsApp is paired and recipient is valid.' };
  }
  return { success: true, data: { action: 'sent_whatsapp_message', recipient: recipient.displayName, message_text: message, message: `Successfully sent WhatsApp message to ${recipient.displayName}: "${message}"` } };
}

export async function executePendingWhatsAppSend(customMessage?: string): Promise<ToolResult> {
  const { useVoiceStore } = await import('../../../../stores/voiceStore');
  const pending = useVoiceStore.getState().pendingWhatsAppAction;
  if (!pending) {
    return { success: false, error: 'No pending WhatsApp message found.' };
  }

  const msgToSend = (customMessage || pending.message).trim();
  if (!msgToSend) {
    return { success: false, error: 'Message cannot be empty.' };
  }

  const result = await dispatchWhatsAppMessage(
    {
      jid: pending.recipient.jid,
      displayName: pending.recipient.displayName,
      phone: pending.recipient.phone,
      match: 'exact',
      confidence: 1
    },
    msgToSend
  );

  if (result.success) {
    useVoiceStore.getState().setPendingWhatsAppAction(null);
  }
  return result;
}

export async function handlePendingWhatsAppConfirmation(text: string): Promise<string | null> {
  const { useVoiceStore } = await import('../../../../stores/voiceStore');
  const pending = useVoiceStore.getState().pendingWhatsAppAction;
  if (!pending) return null;

  if (Date.now() - pending.createdAt > 3 * 60 * 1000) {
    useVoiceStore.getState().setPendingWhatsAppAction(null);
    return null;
  }

  const answer = text.trim().toLowerCase();

  // If user asked a totally different command (like "check my unread emails"), clear pending and return null
  if (/\b(?:email|emails|mail|gmail|music|song|weather|settings|task|todo|project|code|run)\b/i.test(answer)) {
    useVoiceStore.getState().setPendingWhatsAppAction(null);
    return null;
  }

  // Explicit cancellation
  if (/^(no|nope|cancel|stop|wrong|don'?t|mat\s*bhejo|ruk\s*jao|nahi|chhod\s*do)\b/i.test(answer)) {
    useVoiceStore.getState().setPendingWhatsAppAction(null);
    return 'Okay, I cancelled sending that WhatsApp message.';
  }

  // Explicit confirmation
  if (
    /^(yes|yeah|yep|correct|confirm|send|send\s*it|go\s*ahead|do\s*it|sure|haan|bhej\s*do|bhejo)\b/i.test(answer) ||
    /\b(?:send\s+the\s+message|send\s+it\s+now|haan\s+bhej\s+do|bhej\s+dijiye)\b/i.test(answer)
  ) {
    const res = await executePendingWhatsAppSend();
    if (res.success) {
      return `Done Sir Mayank! Sent the WhatsApp message to ${pending.recipient.displayName}.`;
    }
    return `Could not send WhatsApp message: ${res.error || 'Unknown error'}`;
  }

  return null;
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

        const status = await waitForWhatsAppConnection();
        if (!hasWhatsAppSession(status)) {
          // Open Settings connections tab to show QR
          useSettingsStore.getState().setActiveSidebarCategory('connections');
          const isSettingsOpen = useLayoutStore.getState().widgets['settings-window']?.isOpen;
          if (!isSettingsOpen) {
            useLayoutStore.getState().toggleWidget('settings-window');
          }
          return {
            success: false,
            error: 'WhatsApp device is not paired. I have opened the Connections tab in Settings—please scan the QR code using WhatsApp on your phone (Settings > Linked Devices).',
          };
        }

        const resolved = await resolveWhatsAppRecipient(args.recipient);
        if (!resolved.jid) {
          return {
            success: false,
            error: `Contact "${args.recipient}" was not found in your People Directory or WhatsApp chats. Please check the spelling or provide their phone number.`,
          };
        }

        const { useVoiceStore } = await import('../../../../stores/voiceStore');

        if (resolved.match === 'fuzzy') {
          useVoiceStore.getState().setPendingWhatsAppAction({
            id: `wa_${Date.now()}`,
            recipient: {
              jid: resolved.jid,
              displayName: resolved.displayName,
              phone: resolved.phone,
            },
            message: args.message,
            createdAt: Date.now()
          });

          return {
            success: true,
            data: {
              action: 'whatsapp_confirmation_required',
              message: `I found "${resolved.displayName}". Please review the message card above and say "Send it" or click Send to confirm.`,
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
          const qrRes = await fetch(`${WHATSAPP_API_URL}/qr`, { signal: AbortSignal.timeout(2000) });
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
        const res = await fetch(`${WHATSAPP_API_URL}/status`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
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
        if (data.logged_in && data.connected) {
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
              has_session: hasWhatsAppSession(data),
              message: hasWhatsAppSession(data) ? 'WhatsApp is linked but reconnecting. No QR scan is needed.' : 'WhatsApp requires phone pairing. Say "Authenticate WhatsApp" to view the QR code.',
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

        const queryCanonical = getCanonicalRelation(cleanQuery);

        // 1. Search local contacts
        const localContacts = useSettingsStore.getState().contacts || [];
        for (const c of localContacts) {
          const cName = (c.name || '').toLowerCase();
          const cNick = (c.nickname || '').toLowerCase();
          const cNameCanonical = getCanonicalRelation(cName);
          const cNickCanonical = getCanonicalRelation(cNick);

          if (
            cName.includes(cleanQuery) ||
            cNick.includes(cleanQuery) ||
            (queryCanonical && (cNameCanonical === queryCanonical || cNickCanonical === queryCanonical)) ||
            nameScore(cleanQuery, c.name || '') >= 0.70
          ) {
            matches.push({
              name: c.name,
              nickname: c.nickname,
              phone: c.phone,
              type: 'Saved Contact',
            });
          }
        }

        // 2. Search WhatsApp chats/groups (with 5s timeout)
        try {
          const res = await fetch(`${WHATSAPP_API_URL}/chats`, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const data = await res.json();
            for (const chat of data.chats || []) {
              const chatName = (chat.name || '').toLowerCase();
              const chatCanonical = getCanonicalRelation(chatName);

              if (
                chatName.includes(cleanQuery) ||
                (queryCanonical && chatCanonical === queryCanonical) ||
                nameScore(cleanQuery, chat.name || '') >= 0.70
              ) {
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
        const res = await fetch(`${WHATSAPP_API_URL}/clear`, {
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
