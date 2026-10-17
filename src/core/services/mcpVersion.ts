export function hasMcpUpdate(installed?: string, available?: string): boolean {
  if (!installed || !available) return false;
  const parse = (value: string) => /^v?(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+.*)?$/.exec(value);
  const current = parse(installed), latest = parse(available);
  if (!current || !latest) return false;
  for (let index = 1; index <= 3; index++) {
    if (+latest[index] !== +current[index]) return +latest[index] > +current[index];
  }
  if (current[4] && !latest[4]) return true;
  if (!current[4] || !latest[4]) return false;
  const a = current[4].split('.'), b = latest[4].split('.');
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (a[index] === b[index]) continue;
    if (a[index] === undefined) return true;
    if (b[index] === undefined) return false;
    const an = /^\d+$/.test(a[index]), bn = /^\d+$/.test(b[index]);
    return an && bn ? +b[index] > +a[index] : an !== bn ? an : b[index] > a[index];
  }
  return false;
}
