/**
 * Minimal E.164 normalization. North-America-first, since the field org is DFW.
 * Returns "" when the input has no usable digits.
 */
export function toE164(raw: string | null | undefined, defaultCountryCode = "1"): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (hasPlus) return `+${digits}`;
  if (defaultCountryCode === "1") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  }
  return `+${digits}`;
}

/** Pretty-print an E.164 value for display. Falls back to the raw string. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  return value;
}
