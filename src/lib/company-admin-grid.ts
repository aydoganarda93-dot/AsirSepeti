import type { ItemCategory, Shift } from "@prisma/client";

/** `Company.adminNote` içindeki grid öneki — İşletmeler sayfası ile aynı */
export const GRID_PREFIX = "__GRID__:";

export type CompanyGridPayload = {
  cesit: string;
  oglen: string;
  oglenEkmek: string;
  oglenEkmekArasi: string;
  oglenKumanya: string;
  aksam: string;
  aksamEkmek: string;
  aksamEkmekArasi: string;
  aksamKumanya: string;
  gece: string;
  geceEkmek: string;
  geceKumanya: string;
  aciklama: string;
};

export type CompanyGridNumericKey =
  | "oglen"
  | "oglenEkmek"
  | "oglenEkmekArasi"
  | "oglenKumanya"
  | "aksam"
  | "aksamEkmek"
  | "aksamEkmekArasi"
  | "aksamKumanya"
  | "gece"
  | "geceEkmek"
  | "geceKumanya";

export type CompanyGridNumericDeltas = Record<CompanyGridNumericKey, number>;

const GRID_KEYS_NUMERIC: readonly CompanyGridNumericKey[] = [
  "oglen",
  "oglenEkmek",
  "oglenEkmekArasi",
  "oglenKumanya",
  "aksam",
  "aksamEkmek",
  "aksamEkmekArasi",
  "aksamKumanya",
  "gece",
  "geceEkmek",
  "geceKumanya",
];

export function emptyGridPayload(): CompanyGridPayload {
  return {
    cesit: "",
    oglen: "",
    oglenEkmek: "",
    oglenEkmekArasi: "",
    oglenKumanya: "",
    aksam: "",
    aksamEkmek: "",
    aksamEkmekArasi: "",
    aksamKumanya: "",
    gece: "",
    geceEkmek: "",
    geceKumanya: "",
    aciklama: "",
  };
}

function strField(raw: unknown): string {
  return raw == null ? "" : String(raw);
}

/** Eski `kumanya` sütunu → gece kumanya (birleşik gece verisi en iyi tahmin) */
function migrateLegacyKumanya(parsed: Record<string, unknown>): string {
  const legacy = strField(parsed.kumanya).trim();
  const existing = strField(parsed.geceKumanya).trim();
  if (existing) return existing;
  return legacy;
}

export function parseAdminNoteToGrid(adminNote: string | null): CompanyGridPayload {
  if (!adminNote) return emptyGridPayload();

  if (adminNote.startsWith(GRID_PREFIX)) {
    try {
      const parsed = JSON.parse(adminNote.replace(GRID_PREFIX, "")) as Record<string, unknown>;
      return {
        cesit: strField(parsed.cesit),
        oglen: strField(parsed.oglen),
        oglenEkmek: strField(parsed.oglenEkmek),
        oglenEkmekArasi: strField(parsed.oglenEkmekArasi),
        oglenKumanya: strField(parsed.oglenKumanya),
        aksam: strField(parsed.aksam),
        aksamEkmek: strField(parsed.aksamEkmek),
        aksamEkmekArasi: strField(parsed.aksamEkmekArasi),
        aksamKumanya: strField(parsed.aksamKumanya),
        gece: strField(parsed.gece),
        geceEkmek: strField(parsed.geceEkmek),
        geceKumanya: migrateLegacyKumanya(parsed),
        aciklama: strField(parsed.aciklama),
      };
    } catch {
      return { ...emptyGridPayload(), aciklama: adminNote };
    }
  }

  return { ...emptyGridPayload(), aciklama: adminNote };
}

export function serializeGridToAdminNote(payload: CompanyGridPayload): string {
  const body: CompanyGridPayload = { ...payload };
  return `${GRID_PREFIX}${JSON.stringify(body)}`;
}

/**
 * Hücredeki baştaki tam sayıyı okur; "20", "20 kap", "  15" desteklenir.
 * Serbest metin (ör. "Yoğurt") için 0 — birleştirmede sadece sayısal kısım güncellenir.
 */
export function parseGridNumericPrefix(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const match = /^(\d+)/.exec(trimmed);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
}

export function formatGridNumber(n: number): string {
  return String(Math.max(0, Math.floor(n)));
}

export type OrderItemLike = {
  shift: Shift;
  category: ItemCategory;
  quantity: number;
};

function emptyNumericDeltas(): CompanyGridNumericDeltas {
  return {
    oglen: 0,
    oglenEkmek: 0,
    oglenEkmekArasi: 0,
    oglenKumanya: 0,
    aksam: 0,
    aksamEkmek: 0,
    aksamEkmekArasi: 0,
    aksamKumanya: 0,
    gece: 0,
    geceEkmek: 0,
    geceKumanya: 0,
  };
}

/**
 * Sipariş kalemlerinden İşletmeler tablosu hücrelerine eklenecek adetler.
 * Her (shift, category) yalnızca ilgili payload alanına yansır.
 */
export function computeGridDeltasFromOrderItems(items: OrderItemLike[]): CompanyGridNumericDeltas {
  const deltas = emptyNumericDeltas();

  for (const item of items) {
    const q = item.quantity;
    if (q <= 0) continue;

    if (item.shift === "MORNING") {
      if (item.category === "OGLEN_YEMEGI") deltas.oglen += q;
      if (item.category === "DUZ_EKMEK") deltas.oglenEkmek += q;
      if (item.category === "EKMEK_ARASI") deltas.oglenEkmekArasi += q;
      if (item.category === "KUMANYA") deltas.oglenKumanya += q;
    } else if (item.shift === "EVENING") {
      if (item.category === "OGLEN_YEMEGI") deltas.aksam += q;
      if (item.category === "DUZ_EKMEK") deltas.aksamEkmek += q;
      if (item.category === "EKMEK_ARASI") deltas.aksamEkmekArasi += q;
      if (item.category === "KUMANYA") deltas.aksamKumanya += q;
    } else if (item.shift === "NIGHT") {
      if (item.category === "OGLEN_YEMEGI") deltas.gece += q;
      if (item.category === "DUZ_EKMEK") deltas.geceEkmek += q;
      if (item.category === "KUMANYA") deltas.geceKumanya += q;
    }
  }

  return deltas;
}

export function hasGridDeltas(deltas: CompanyGridNumericDeltas): boolean {
  return Object.values(deltas).some((v) => v > 0);
}

export function applyNumericDeltasToGridPayload(
  payload: CompanyGridPayload,
  deltas: CompanyGridNumericDeltas,
  sign: 1 | -1,
): CompanyGridPayload {
  const next: CompanyGridPayload = { ...payload };
  for (const key of GRID_KEYS_NUMERIC) {
    const delta = deltas[key] * sign;
    if (delta === 0) continue;
    const cur = parseGridNumericPrefix(next[key]);
    next[key] = formatGridNumber(cur + delta);
  }
  return next;
}

export function mergeCompanyAdminNoteWithDeltas(
  adminNote: string | null,
  deltas: CompanyGridNumericDeltas,
  sign: 1 | -1,
): string {
  const parsed = parseAdminNoteToGrid(adminNote);
  const merged = applyNumericDeltasToGridPayload(parsed, deltas, sign);
  return serializeGridToAdminNote(merged);
}
