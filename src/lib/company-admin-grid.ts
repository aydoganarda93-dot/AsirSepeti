import type { ItemCategory, Shift } from "@prisma/client";

/** `Company.adminNote` içindeki grid öneki — İşletmeler sayfası ile aynı */
export const GRID_PREFIX = "__GRID__:";

export type CompanyGridPayload = {
  cesit: string;
  oglen: string;
  oglenDetay: string;
  oglenEkmek: string;
  aksam: string;
  aksamEkmek: string;
  kumanya: string;
  aciklama: string;
};

const GRID_KEYS_NUMERIC = ["kumanya", "oglen", "aksam", "oglenEkmek", "aksamEkmek"] as const;

export function emptyGridPayload(): CompanyGridPayload {
  return {
    cesit: "",
    oglen: "",
    oglenDetay: "",
    oglenEkmek: "",
    aksam: "",
    aksamEkmek: "",
    kumanya: "",
    aciklama: "",
  };
}

export function parseAdminNoteToGrid(adminNote: string | null): CompanyGridPayload {
  if (!adminNote) return emptyGridPayload();

  if (adminNote.startsWith(GRID_PREFIX)) {
    try {
      const parsed = JSON.parse(adminNote.replace(GRID_PREFIX, "")) as Partial<CompanyGridPayload>;
      return {
        cesit: parsed.cesit ?? "",
        oglen: parsed.oglen ?? "",
        oglenDetay: parsed.oglenDetay ?? "",
        oglenEkmek: parsed.oglenEkmek ?? "",
        aksam: parsed.aksam ?? "",
        aksamEkmek: parsed.aksamEkmek ?? "",
        kumanya: parsed.kumanya ?? "",
        aciklama: parsed.aciklama ?? "",
      };
    } catch {
      return { ...emptyGridPayload(), aciklama: adminNote };
    }
  }

  return { ...emptyGridPayload(), aciklama: adminNote };
}

export function serializeGridToAdminNote(payload: CompanyGridPayload): string {
  const body: CompanyGridPayload = {
    cesit: payload.cesit,
    oglen: payload.oglen,
    oglenDetay: payload.oglenDetay,
    oglenEkmek: payload.oglenEkmek,
    aksam: payload.aksam,
    aksamEkmek: payload.aksamEkmek,
    kumanya: payload.kumanya,
    aciklama: payload.aciklama,
  };
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

/**
 * Sipariş kalemlerinden İşletmeler tablosu sütunlarına eklenecek adetler.
 * - Kumanya sütunu: tüm vardiyalarda KUMANYA + gece (NIGHT) yemek (OGLEN_YEMEGI)
 * - Öğlen sayı: sabah yemek
 * - Akşam sayı: akşam vardiyası yemek
 * - Ekmek: sabah → öğlen ekmek; akşam+gece → akşam ekmek
 */
export function computeGridDeltasFromOrderItems(items: OrderItemLike[]): {
  kumanya: number;
  oglen: number;
  aksam: number;
  oglenEkmek: number;
  aksamEkmek: number;
} {
  let kumanya = 0;
  let oglen = 0;
  let aksam = 0;
  let oglenEkmek = 0;
  let aksamEkmek = 0;

  for (const item of items) {
    const q = item.quantity;
    if (q <= 0) continue;

    if (item.category === "KUMANYA") {
      kumanya += q;
    }
    if (item.category === "OGLEN_YEMEGI") {
      if (item.shift === "MORNING") oglen += q;
      if (item.shift === "EVENING") aksam += q;
      if (item.shift === "NIGHT") kumanya += q;
    }
    if (item.category === "EKMEK_ARASI" || item.category === "DUZ_EKMEK") {
      if (item.shift === "MORNING") oglenEkmek += q;
      if (item.shift === "EVENING" || item.shift === "NIGHT") aksamEkmek += q;
    }
  }

  return { kumanya, oglen, aksam, oglenEkmek, aksamEkmek };
}

export function applyNumericDeltasToGridPayload(
  payload: CompanyGridPayload,
  deltas: { kumanya: number; oglen: number; aksam: number; oglenEkmek: number; aksamEkmek: number },
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
  deltas: { kumanya: number; oglen: number; aksam: number; oglenEkmek: number; aksamEkmek: number },
  sign: 1 | -1,
): string {
  const parsed = parseAdminNoteToGrid(adminNote);
  const merged = applyNumericDeltasToGridPayload(parsed, deltas, sign);
  return serializeGridToAdminNote(merged);
}
