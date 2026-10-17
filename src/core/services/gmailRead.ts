import { invoke } from '@tauri-apps/api/core';

type Part = {mimeType?: string; filename?: string; body?: {data?: string}; parts?: Part[]};
async function call(name: string, args: Record<string, unknown>) {
  const data = JSON.parse(await invoke<string>('mcp_call_tool', {serverId: 'google-workspace-mcp', toolName: name, arguments: args}));
  if (data.error || data.status === 'error') throw new Error(data.error || data.message);
  return data;
}
function decode(value: string) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(raw, ch => ch.charCodeAt(0)));
}
export async function readGmailSubject(subject: string): Promise<string> {
  const clean = subject.replace(/^\d+[.)]\s*/, '').replace(/\s+(?:this\s+)?(?:email|mail)[.!?]*$/i, '').replace(/^["“]|["”]$/g, '').trim();
  if (!clean) return 'Which email subject should I read?';
  const query = `subject:"${clean.replace(/["\\]/g, ' ')}"`;
  const result = await call('gmail_search', { query, max_results: 10 });
  const messages = result.messages || [];
  if (!messages.length) return `I could not find an email with the subject “${clean}”.`;
  const exact = messages.filter((item: {subject?: string}) => item.subject?.toLowerCase() === clean.toLowerCase());
  const matches = exact.length ? exact : messages;
  if (matches.length !== 1) return `I found multiple matching emails. Please include the sender or a more specific subject: ${matches.map((item: {subject: string; sender: string}) => `${item.subject}, from ${item.sender}`).join('; ')}`;
  const selected = matches[0];
  const message = await call('gmail_get_message', {message_id: selected.id});
  const plain: string[] = [], html: string[] = [], attachments: string[] = [];
  function walk(part: Part) {
    if (part.filename) { attachments.push(part.filename); return; }
    if (part.body?.data && part.mimeType === 'text/plain') plain.push(decode(part.body.data));
    else if (part.body?.data && part.mimeType === 'text/html') html.push(decode(part.body.data));
    part.parts?.forEach(walk);
  }
  walk(message.payload || {});
  const text = (plain.join('\n') || new DOMParser().parseFromString(html.join('\n'), 'text/html').body.textContent || message.snippet || '').trim();
  if (!text) return `Found “${selected.subject}”, but it has no readable message body.${attachments.length ? ` Attachments: ${attachments.join(', ')}. Attachment contents are not read yet.` : ''}`;
  return `${selected.subject}. From ${selected.sender}.\n\n${text.slice(0, 12000)}${text.length > 12000 ? '\n[Message truncated]' : ''}${attachments.length ? `\nAttachments: ${attachments.join(', ')}. Attachment contents are not read yet.` : ''}`;
}
