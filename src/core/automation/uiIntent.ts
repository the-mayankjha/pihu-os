/** Conservative shortcuts; other phrasings remain available to the language model. */
export function parseUIIntent(text: string): Record<string, unknown> | null {
  const input = text.trim().replace(/^please\s+/i, '').replace(/[.!?]+$/, '');
  const split = input.match(/^(.*)\s+in\s+(.+)$/i) || input.match(/^(.*)\s+on\s+(Safari|(?:Google )?Chrome|Brave(?: Browser)?|Firefox|(?:Microsoft )?Edge)$/i);
  const rawCommand = split ? split[1] : input;
  // Spoken self-correction: use the explicit ordinal after ‘or’.
  const command = rawCommand.match(/\s+or\s+((?:click|select|open)\s+(?:the\s+)?(?:first|second|third|fourth|fifth|\d+)\s+(?:option|result|item|link|button))$/i)?.[1] || rawCommand;
  const app = split ? { app: split[2] } : {};
  const scroll = command.match(/^scroll\s+(up|down|left|right)(?:\s+(\d+)(?:\s+lines?)?)?$/i);
  if (scroll) return { action: 'scroll', direction: scroll[1].toLowerCase(), amount: Number(scroll[2] || 5), ...app };
  const repeated = command.match(/^click\s+(?:on\s+)?(.+?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty)\s+times$/i);
  if (repeated) {
    const words: Record<string, number> = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twenty:20};
    return {action:'click', label:repeated[1], count:words[repeated[2].toLowerCase()] ?? Number(repeated[2]), ...app};
  }
  const ordinal = command.match(/^(click|select|open)\s+(?:on\s+)?(?:the\s+)?(first|second|third|fourth|fifth|\d+)(?:st|nd|rd|th)?\s+(result|item|link|button|option)$/i);
  if (ordinal) {
    const index = ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(ordinal[2].toLowerCase()) + 1 || Number(ordinal[2]);
    return { action: ordinal[1].toLowerCase() === 'select' ? 'select' : 'click', kind: ordinal[3].toLowerCase() === 'option' ? 'result' : ordinal[3].toLowerCase(), index, ...app };
  }
  const inspect = command.match(/^(?:show|list|inspect)\s+(?:the\s+)?(?:visible\s+)(items|links|buttons|results|controls)$/i);
  if (inspect) return { action: 'inspect', kind: inspect[1].toLowerCase().slice(0, -1), ...app };
  const click = command.match(/^click\s+(?:on\s+)?(.+)$/i);
  if (click) return { action: 'click', label: click[1], ...app };
  return null;
}
