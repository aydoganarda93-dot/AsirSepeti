import { formatUtcYmdFromOffset } from "@/lib/date";
import { db } from "@/lib/db";
import {
  contentTypeForMenuKind,
  monthlyMenuKindFromName,
  monthlyMenuKindFromPath,
  MONTHLY_MENU_BUCKET,
  MONTHLY_MENU_SIGNED_TTL_SEC,
  type MonthlyMenuKind,
} from "@/lib/monthly-menu-constants";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

/** İstanbul takvimine göre `yyyy-MM` (müşteri sipariş günü ile uyumlu). */
export function currentYearMonthIstanbul(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (year && month) return `${year}-${month}`;
  return formatUtcYmdFromOffset(0).slice(0, 7);
}

export function resolveYearMonthParam(value: string | null): string {
  if (value && YEAR_MONTH_RE.test(value)) return value;
  return currentYearMonthIstanbul();
}

export async function getSettingsRow() {
  return db.appSettings.findUnique({ where: { id: 1 } });
}

export type ActiveMenu = {
  path: string;
  fileName: string | null;
  updatedAt: Date | null;
  yearMonth: string;
  kind: MonthlyMenuKind;
};

function activeMenuFromSettings(
  s: NonNullable<Awaited<ReturnType<typeof getSettingsRow>>>,
): ActiveMenu {
  const kind =
    monthlyMenuKindFromName(s.monthlyMenuFileName) ??
    monthlyMenuKindFromPath(s.monthlyMenuStoragePath!) ??
    "pdf";

  return {
    path: s.monthlyMenuStoragePath!,
    fileName: s.monthlyMenuFileName,
    updatedAt: s.monthlyMenuUpdatedAt,
    yearMonth: s.monthlyMenuYearMonth!,
    kind,
  };
}

/** Veritabanındaki son yüklenen menü (ay filtresi yok). */
export async function getStoredMenu(): Promise<ActiveMenu | null> {
  const s = await getSettingsRow();
  if (!s?.monthlyMenuStoragePath || !s.monthlyMenuYearMonth) return null;
  return activeMenuFromSettings(s);
}

export async function getActiveMenuForMonth(yearMonth: string): Promise<ActiveMenu | null> {
  const s = await getSettingsRow();
  if (!s?.monthlyMenuStoragePath || !s.monthlyMenuYearMonth) return null;
  if (s.monthlyMenuYearMonth !== yearMonth) return null;
  return activeMenuFromSettings(s);
}

/** İstenen ay için menü; yoksa sunucudaki son yüklenen menüye düşer. */
export async function resolveMenuForRequest(requestedYearMonth: string): Promise<ActiveMenu | null> {
  const exact = await getActiveMenuForMonth(requestedYearMonth);
  if (exact) return exact;
  return getStoredMenu();
}

export async function createSignedMenuUrl(storagePath: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(MONTHLY_MENU_BUCKET)
    .createSignedUrl(storagePath, MONTHLY_MENU_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "signed_url_failed");
  }
  return data.signedUrl;
}

export async function downloadMenuFile(storagePath: string): Promise<Blob> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(MONTHLY_MENU_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "download_failed");
  }
  return data;
}

/** @deprecated downloadMenuFile kullanın */
export async function downloadMenuPdf(storagePath: string): Promise<Blob> {
  return downloadMenuFile(storagePath);
}

export async function buildMonthlyMenuFileResponse(
  active: ActiveMenu,
): Promise<{ body: ArrayBuffer; contentType: string; fileName: string }> {
  const blob = await downloadMenuFile(active.path);
  const arrayBuffer = await blob.arrayBuffer();
  const safeName = (active.fileName ?? `menu.${active.kind}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return {
    body: arrayBuffer,
    contentType: contentTypeForMenuKind(active.kind),
    fileName: safeName,
  };
}
