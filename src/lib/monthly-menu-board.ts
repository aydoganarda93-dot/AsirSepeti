import * as XLSX from "xlsx";
import { formatDateOnlyTr } from "@/lib/date";

export type MenuBoardRow = string[];

/** Excel’in ham ızgarası — ekstra parse yok */
export type MonthlyMenuGridData = {
  monthLabel: string;
  title: string | null;
  grid: MenuBoardRow[];
};

function formatDateCell(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .replace(/\//g, ".");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateCell(value);
  }
  if (typeof value === "number" && value > 30000 && value < 60000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return formatDateCell(d);
    }
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function rowHasAnyCell(row: MenuBoardRow): boolean {
  return row.some((c) => c.trim().length > 0);
}

/** Kenar boşluklarını kırpar; takvim boşluklarını korur */
function trimGridEdges(matrix: MenuBoardRow[]): MenuBoardRow[] {
  let rows = matrix.map((r) => r.map(cellText));
  if (rows.length === 0) return [];

  while (rows.length > 0 && !rowHasAnyCell(rows[0])) rows.shift();
  while (rows.length > 0 && !rowHasAnyCell(rows[rows.length - 1])) rows.pop();
  if (rows.length === 0) return [];

  const maxCols = Math.max(...rows.map((r) => r.length));
  rows = rows.map((r) => {
    const next = [...r];
    while (next.length < maxCols) next.push("");
    return next;
  });

  let lastCol = maxCols - 1;
  while (lastCol >= 0 && rows.every((r) => !r[lastCol]?.trim())) lastCol -= 1;
  if (lastCol < 0) return [];

  return rows.map((r) => r.slice(0, lastCol + 1));
}

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const matrix: unknown[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as { w?: string; v?: unknown } | undefined;
      row.push(cell?.w ?? cell?.v ?? "");
    }
    matrix.push(row);
  }
  return matrix;
}

function findSheetTitle(matrix: MenuBoardRow[]): string | null {
  for (let i = 0; i < Math.min(6, matrix.length); i += 1) {
    for (const cell of matrix[i]) {
      const t = cell.trim();
      if (t.length >= 8 && /menü|menu|yemek|mayıs|mayis|\d{4}/i.test(t)) return t;
    }
  }
  return null;
}

function scoreGrid(matrix: MenuBoardRow[]): number {
  return matrix.reduce((n, row) => n + row.filter((c) => c.trim()).length, 0);
}

export function formatYearMonthTr(yearMonth: string): string {
  return formatDateOnlyTr(`${yearMonth}-01`);
}

/** @deprecated — sadece grid döner */
export type MonthlyMenuBoardData = MonthlyMenuGridData & {
  days: never[];
  headers: null;
  rows: never[];
};

export function readMonthlyMenuGrid(buffer: ArrayBuffer, yearMonth: string): MonthlyMenuGridData {
  const empty: MonthlyMenuGridData = {
    monthLabel: formatYearMonthTr(yearMonth),
    title: null,
    grid: [],
  };

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  if (workbook.SheetNames.length === 0) return empty;

  let bestGrid: MenuBoardRow[] = [];
  let bestScore = 0;
  let title: string | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const raw = sheetToMatrix(sheet);
    const grid = trimGridEdges(raw.map((row) => (Array.isArray(row) ? row : [row]).map(cellText)));
    const score = scoreGrid(grid);
    if (score > bestScore) {
      bestScore = score;
      bestGrid = grid;
      title = findSheetTitle(grid) ?? title;
    }
  }

  return {
    monthLabel: formatYearMonthTr(yearMonth),
    title,
    grid: bestGrid,
  };
}

/** Eski API uyumluluğu */
export function parseMonthlyMenuWorkbook(buffer: ArrayBuffer, yearMonth: string): MonthlyMenuGridData {
  return readMonthlyMenuGrid(buffer, yearMonth);
}
