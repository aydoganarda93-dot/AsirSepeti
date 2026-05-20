const GRID_DATE_RE = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/;

const DAY_SUBHEADER_RE =
  /^(pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar|arefe|bayram)/i;

export function isGridDateCell(text: string): boolean {
  return GRID_DATE_RE.test(text.trim());
}

export function isGridDaySubheader(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return DAY_SUBHEADER_RE.test(t);
}

export function monthlyMenuCellClassName(text: string): string {
  const t = text.trim();
  if (!t) return "bg-white text-transparent select-none";
  if (isGridDateCell(t)) {
    return "bg-red-700 font-bold text-white text-center whitespace-nowrap";
  }
  if (isGridDaySubheader(t)) {
    return "bg-red-600 text-center text-[10px] font-bold uppercase text-white whitespace-nowrap";
  }
  return "bg-white text-slate-800 align-top";
}
