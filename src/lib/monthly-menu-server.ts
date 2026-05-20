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
  kind: MonthlyMenuKind;
};

export async function getActiveMenuForMonth(yearMonth: string): Promise<ActiveMenu | null> {
  const s = await getSettingsRow();
  if (!s?.monthlyMenuStoragePath || !s.monthlyMenuYearMonth) return null;
  if (s.monthlyMenuYearMonth !== yearMonth) return null;
  const kind =
    monthlyMenuKindFromName(s.monthlyMenuFileName) ??
    monthlyMenuKindFromPath(s.monthlyMenuStoragePath) ??
    "pdf";

  return {
    path: s.monthlyMenuStoragePath,
    fileName: s.monthlyMenuFileName,
    updatedAt: s.monthlyMenuUpdatedAt,
    yearMonth: s.monthlyMenuYearMonth,
    kind,
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
