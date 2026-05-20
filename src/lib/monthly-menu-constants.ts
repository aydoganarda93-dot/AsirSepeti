export const MONTHLY_MENU_BUCKET = "monthly-menus";
export const MONTHLY_MENU_MAX_BYTES = 12 * 1024 * 1024;
export const MONTHLY_MENU_SIGNED_TTL_SEC = 180;

export type MonthlyMenuKind = "pdf" | "xlsx";

export const MONTHLY_MENU_PDF_MIME = "application/pdf";
export const MONTHLY_MENU_XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function monthlyMenuKindFromName(fileName: string | null | undefined): MonthlyMenuKind | null {
  const lower = (fileName ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

export function monthlyMenuKindFromPath(storagePath: string): MonthlyMenuKind | null {
  return monthlyMenuKindFromName(storagePath);
}

export function contentTypeForMenuKind(kind: MonthlyMenuKind): string {
  return kind === "pdf" ? MONTHLY_MENU_PDF_MIME : MONTHLY_MENU_XLSX_MIME;
}

export function validateMonthlyMenuFile(
  file: File,
  buffer: Buffer,
): { ok: true; kind: MonthlyMenuKind } | { ok: false; error: string } {
  const lower = file.name.toLowerCase();

  if (file.size > MONTHLY_MENU_MAX_BYTES) {
    return {
      ok: false,
      error: `Dosya çok büyük (en fazla ${MONTHLY_MENU_MAX_BYTES / 1024 / 1024} MB).`,
    };
  }

  const pdfMime =
    file.type === MONTHLY_MENU_PDF_MIME || file.type === "" || file.type === "application/x-pdf";
  const xlsxMime =
    file.type === MONTHLY_MENU_XLSX_MIME ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "";

  if (lower.endsWith(".pdf") && (pdfMime || file.type === "")) {
    if (buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
      return { ok: false, error: "Geçerli bir PDF dosyası yükleyin." };
    }
    return { ok: true, kind: "pdf" };
  }

  if (lower.endsWith(".xlsx") && (xlsxMime || file.type === "")) {
    if (buffer.length < 4 || buffer.subarray(0, 2).toString() !== "PK") {
      return { ok: false, error: "Geçerli bir Excel (.xlsx) dosyası yükleyin." };
    }
    return { ok: true, kind: "xlsx" };
  }

  return { ok: false, error: "Yalnızca PDF veya Excel (.xlsx) kabul edilir." };
}
