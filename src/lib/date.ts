export function parseDateOnlyUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** UTC takvimine göre (Prisma `@db.Date` ile uyumlu) belirtilen güne sıfır saat */
export function startOfUtcCalendarDay(daysFromUtcToday: number, now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromUtcToday));
}

/** UTC takvimine göre `yyyy-MM-dd` (form input / API ile uyumlu) */
export function formatUtcYmdFromOffset(daysFromUtcToday: number, now: Date = new Date()): string {
  return startOfUtcCalendarDay(daysFromUtcToday, now).toISOString().slice(0, 10);
}

export function formatInstantTr(iso: Date | string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** `yyyy-MM-dd` → İstanbul takvim günü etiketi */
export function formatDateOnlyTr(ymd: string): string {
  const parsed = parseDateOnlyUtc(ymd);
  if (!parsed) return ymd;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

