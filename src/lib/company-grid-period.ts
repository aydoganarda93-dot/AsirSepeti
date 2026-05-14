import { subDays } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";

export const COMPANY_GRID_TZ = "Europe/Istanbul";

/** İstanbul takviminde `now` anının günü için o gün 12:00 (öğle). */
export function istanbulCalendarNoonForInstant(now: Date): Date {
  const ymd = formatInTimeZone(now, COMPANY_GRID_TZ, "yyyy-MM-dd");
  return toDate(`${ymd}T12:00:00`, { timeZone: COMPANY_GRID_TZ });
}

/**
 * İstanbul'da öğle 12:00–12:00 işletme günü: `now` anını içeren aralığın sol ucu
 * (öğleden önce: dün 12:00; öğle ve sonrası: bugün 12:00).
 */
export function liveGridPeriodStart(now: Date): Date {
  const todayNoon = istanbulCalendarNoonForInstant(now);
  if (now.getTime() < todayNoon.getTime()) {
    return subDays(todayNoon, 1);
  }
  return todayNoon;
}

/** Takvim günü (yyyy-MM-dd, İstanbul) + 12:00 → UTC anı. */
export function istanbulNoonFromYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return toDate(`${ymd}T12:00:00`, { timeZone: COMPANY_GRID_TZ });
}

export function formatPeriodStartAsYmd(periodStart: Date): string {
  return formatInTimeZone(periodStart, COMPANY_GRID_TZ, "yyyy-MM-dd");
}
