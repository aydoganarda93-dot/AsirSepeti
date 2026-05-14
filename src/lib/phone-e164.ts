/** TR cep için kabaca E.164 (+90…) normalize — webhook eşlemesi */
export function normalizeToE164Tr(raw: string): string | null {
  const trimmed = raw.replace(/^whatsapp:/i, "").trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("90") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `+90${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("90")) {
    return `+${digits}`;
  }

  if (trimmed.startsWith("+")) return trimmed.replace(/\s/g, "");
  return null;
}
