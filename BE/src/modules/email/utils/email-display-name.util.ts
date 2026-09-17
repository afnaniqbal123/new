/**
 * Formats a person's name for email display (e.g. "hadia rafiq" → "Hadia Rafiq").
 */
export function formatEmailDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) =>
          part
            .split("'")
            .map(
              (segment) =>
                segment.charAt(0).toUpperCase() +
                segment.slice(1).toLowerCase(),
            )
            .join("'"),
        )
        .join('-'),
    )
    .join(' ');
}

const EMAIL_NAME_FIELDS = [
  'name',
  'invitedUserName',
  'firstName',
  'lastName',
] as const;

export function formatEmailTemplateContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const formatted = { ...context };

  for (const field of EMAIL_NAME_FIELDS) {
    const value = formatted[field];
    if (typeof value === 'string' && value.trim()) {
      formatted[field] = formatEmailDisplayName(value);
    }
  }

  return formatted;
}
