/**
 * Normalizes an email for storage/sending without stripping plus-address tags.
 */
export function normalizeEmailAddress(
  value?: string | null,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed.toLowerCase();
  }

  const localPart = trimmed.slice(0, atIndex).toLowerCase();
  const domainPart = trimmed.slice(atIndex + 1).toLowerCase();

  return `${localPart}@${domainPart}`;
}
