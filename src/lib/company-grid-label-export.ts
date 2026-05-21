import ExcelJS from "exceljs";
import { formatGridNumber, parseGridNumericPrefix } from "@/lib/company-admin-grid";
import type { CompanyOrderGridHints } from "@/lib/company-grid-order-hints";
import { formatDateOnlyTr } from "@/lib/date";

export type MealLabelKind = "oglen" | "aksam";

export type MealLabelRow = {
  id: string;
  companyName: string;
  oglen: string;
  aksam: string;
};

function stripHintSuffix(hint: string): string {
  return hint.replace(/\s*(kum|düz|arası)\s*$/i, "").trim();
}

function orderHintForMeal(hints: CompanyOrderGridHints | undefined, meal: MealLabelKind): string | null {
  if (!hints) return null;
  return meal === "oglen" ? hints.oglenOrderLine : hints.aksamOrderLine;
}

/**
 * Grid ile aynı mantık: önce elle girilen adet; boşsa ve hücre düzenlenmemişse sipariş özeti.
 */
export function resolveMealLabelQuantity(
  gridValue: string,
  orderHint: string | null | undefined,
  useOrderFallback: boolean,
): string | null {
  const fromGrid = parseGridNumericPrefix(gridValue);
  if (fromGrid > 0) return formatGridNumber(fromGrid);

  if (!useOrderFallback || !orderHint) return null;
  const fromOrder = parseGridNumericPrefix(stripHintSuffix(orderHint));
  if (fromOrder <= 0) return null;
  return formatGridNumber(fromOrder);
}

const LABELS_PER_ROW = 5;

const MEAL_CONFIG: Record<
  MealLabelKind,
  { field: MealLabelKind; sheetTitle: string; fileSlug: string; headerTitle: string }
> = {
  oglen: {
    field: "oglen",
    sheetTitle: "Öğle",
    fileSlug: "ogle",
    headerTitle: "ÖĞLE YEMEĞİ",
  },
  aksam: {
    field: "aksam",
    sheetTitle: "Akşam",
    fileSlug: "aksam",
    headerTitle: "AKŞAM YEMEĞİ",
  },
};

function truncateCompanyName(name: string, maxLen = 28): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function collectMealLabelEntries(
  rows: MealLabelRow[],
  meal: MealLabelKind,
  options?: {
    orderHintsByCompany?: Map<string, CompanyOrderGridHints>;
    /** Satırda ilgili öğün hücresi patch ile değiştirildiyse sipariş ipucu kullanılmaz */
    patchedMealFields?: Record<string, Partial<Record<MealLabelKind, boolean>>>;
  },
): { name: string; quantity: string }[] {
  const { field } = MEAL_CONFIG[meal];
  const hintsMap = options?.orderHintsByCompany;
  const patched = options?.patchedMealFields;

  return rows
    .map((row) => {
      const hints = hintsMap?.get(row.id);
      const hintLine = orderHintForMeal(hints, meal);
      const fieldPatched = patched?.[row.id]?.[meal] === true;
      const quantity = resolveMealLabelQuantity(row[field], hintLine, !fieldPatched);
      if (!quantity) return null;
      return { name: truncateCompanyName(row.companyName), quantity };
    })
    .filter((entry): entry is { name: string; quantity: string } => entry !== null);
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFCBD5E1" } };
  return { top: side, left: side, bottom: side, right: side };
}

function triggerBrowserDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Öğle veya akşam yemek etiketleri — 5 fabrika yan yana, altında yalnızca adet.
 */
export async function downloadMealLabelsXlsx(options: {
  rows: MealLabelRow[];
  meal: MealLabelKind;
  dateYmd: string;
  orderHintsByCompany?: Map<string, CompanyOrderGridHints>;
  patchedMealFields?: Record<string, Partial<Record<MealLabelKind, boolean>>>;
}): Promise<{ count: number; filename: string }> {
  const { rows, meal, dateYmd, orderHintsByCompany, patchedMealFields } = options;
  const config = MEAL_CONFIG[meal];
  const entries = collectMealLabelEntries(rows, meal, { orderHintsByCompany, patchedMealFields });

  if (entries.length === 0) {
    throw new Error(
      `${config.sheetTitle} için yazdırılacak adet bulunamadı. Gridde adet girin veya o güne ait onaylı sipariş olmalı.`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Asır Sepeti";
  const sheet = workbook.addWorksheet(config.sheetTitle, {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ showGridLines: false }],
  });

  for (let c = 1; c <= LABELS_PER_ROW; c++) {
    sheet.getColumn(c).width = 22;
  }

  const dateLabel = formatDateOnlyTr(dateYmd);
  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  sheet.mergeCells(1, 1, 1, LABELS_PER_ROW);
  const titleCell = titleRow.getCell(1);
  titleCell.value = `${dateLabel} · ${config.headerTitle}`;
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: meal === "oglen" ? "FFFEF3C7" : "FFE0E7FF" },
  };
  titleCell.border = thinBorder();

  let excelRow = 3;
  for (let i = 0; i < entries.length; i += LABELS_PER_ROW) {
    const chunk = entries.slice(i, i + LABELS_PER_ROW);

    const nameRow = sheet.getRow(excelRow);
    nameRow.height = 36;
    for (let col = 1; col <= LABELS_PER_ROW; col++) {
      const entry = chunk[col - 1];
      const cell = nameRow.getCell(col);
      cell.value = entry?.name ?? "";
      cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
      cell.border = thinBorder();
    }

    const qtyRow = sheet.getRow(excelRow + 1);
    qtyRow.height = 52;
    for (let col = 1; col <= LABELS_PER_ROW; col++) {
      const entry = chunk[col - 1];
      const cell = qtyRow.getCell(col);
      cell.value = entry?.quantity ?? "";
      cell.font = { name: "Calibri", size: 32, bold: true, color: { argb: "FF0F172A" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      cell.border = thinBorder();
    }

    excelRow += 3;
  }

  const suffix = dateYmd || "tarih";
  const filename = `etiket-${config.fileSlug}-${suffix}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  triggerBrowserDownload(buffer, filename);

  return { count: entries.length, filename };
}
