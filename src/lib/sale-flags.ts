const DEPOSIT_PREFIX = "[SEÑA]";

export function isDeposit(notes: string | null | undefined): boolean {
  return !!notes?.trim().startsWith(DEPOSIT_PREFIX);
}

export function stripDepositFlag(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (!trimmed.startsWith(DEPOSIT_PREFIX)) return notes;
  const stripped = trimmed.slice(DEPOSIT_PREFIX.length).trim();
  return stripped.length > 0 ? stripped : null;
}

export function addDepositFlag(notes: string | null | undefined): string {
  if (!notes) return DEPOSIT_PREFIX;
  if (isDeposit(notes)) return notes;
  return `${DEPOSIT_PREFIX} ${notes}`;
}
