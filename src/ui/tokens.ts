// Design tokens are the single source of truth for durations and colors.
// These helpers read them off the document root so the code never hard-codes
// a timing or a palette value.
export function readToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

// Reads a duration token in milliseconds.
export function readDuration(token: string): number {
  const raw = readToken(token);

  if (raw.endsWith('ms')) {
    return Number.parseFloat(raw) || 0;
  }

  if (raw.endsWith('s')) {
    return (Number.parseFloat(raw) || 0) * 1000;
  }

  return 0;
}
