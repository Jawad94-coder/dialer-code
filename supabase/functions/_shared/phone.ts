export function normalizePhone(value: string): string | null {
  const normalized = value.replace(/[^\d+]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
