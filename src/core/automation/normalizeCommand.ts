/** Remove conversational wrappers and STT punctuation at command boundaries only. */
export function normalizeCommand(text: string): string {
  let command = text.trim().replace(/[.!?]+$/, '').trim();
  const prefix = /^(?:(?:can|could|would|will)\s+you|i\s+(?:want|would\s+like)\s+to|please)[\s,]+/i;
  while (prefix.test(command)) command = command.replace(prefix, '').trim();
  return command.replace(/\b(search|play|open|click|scroll|select|move)\s*,\s*/gi, '$1 ');
}
