/**
 * Path security utilities
 * Prevents path traversal attacks
 */

/**
 * Detect path traversal attacks
 *
 * Note: A naive path.includes('..') would produce false positives for
 * legitimate filenames like foo..bar, so a more precise regex is used.
 */
export function containsPathTraversal(path: string): boolean {
  // Detect ../ or ..\ only when combined with path separators:
  // ^..   : leading ..
  // /.. or \.. : .. after path separator
  // ../ or ..\ : .. before path separator
  // ..$   : trailing ..
  if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path)) return true;
  // Detect absolute paths
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return true;
  // Detect URL-encoded .. combined with path separators
  if (/(?:^|%2f|%5c)%2e%2e(?:%2f|%5c|$)/i.test(path)) return true;
  return false;
}

/**
 * Resolve template variables in a vault path
 * Supported variables: {platform}, {year}, {month}, {weekday}, {title}, {sessionId}
 * Unknown variables are preserved as-is (safe fallback)
 *
 * @example
 * resolvePathTemplate('AI/{platform}/{year}-{month}', { platform: 'gemini', year: '2026', month: '03' })
 * // → 'AI/gemini/2026-03'
 */
export function resolvePathTemplate(path: string, variables: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (match, key: string) => {
    return key in variables ? variables[key] : match;
  });
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Build date-based template variables from a Date object
 */
export function buildDateVariables(date: Date): Record<string, string> {
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    weekday: WEEKDAY_NAMES[date.getDay()],
  };
}

/**
 * Sanitize a string for use in file/folder names
 * Removes characters not allowed in file names and replaces spaces with hyphens
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
