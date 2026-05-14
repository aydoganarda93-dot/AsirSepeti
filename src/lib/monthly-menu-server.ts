import { formatUtcYmdFromOffset } from "@/lib/date";
import { db } from "@/lib/db";
import { MONTHLY_MENU_BUCKET, MONTHLY_MENU_SIGNED_TTL_SEC } from "@/lib/monthly-menu-constants";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

export function resolveYearMonthParam(value: string | null): string {
  if (value && YEAR_MONTH_RE.test(value)) return value;
  return formatUtcYmdFromOffset(0).slice(0, 7);
}

export async function getSettingsRow() {
  return db.appSettings.findUnique({ where: { id: 1 } });
}

export type ActiveMenu = {
  path: string;
  fileName: string | null;
  updatedAt: Date | null;
  yearMonth: string;
};

export async function getActiveMenuForMonth(yearMonth: string): Promise<ActiveMenu | null> {
  const s = await getSettingsRow();
  if (!s?.monthlyMenuStoragePath || !s.monthlyMenuYearMonth) return null;
  if (s.monthlyMenuYearMonth !== yearMonth) return null;
  return {
    path: s.monthlyMenuStoragePath,
    fileName: s.monthlyMenuFileName,
    updatedAt: s.monthlyMenuUpdatedAt,
    yearMonth: s.monthlyMenuYearMonth,
  };
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

export async function downloadMenuPdf(storagePath: string): Promise<Blob> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(MONTHLY_MENU_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "download_failed");
  }
  return data;
}
