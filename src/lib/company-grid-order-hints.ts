import type { ItemCategory, Shift } from "@prisma/client";

export type OrderItemForHint = {
  shift: Shift;
  category: ItemCategory;
  quantity: number;
};

export type CompanyOrderGridHints = {
  /** Öğle adet altı: sabah yemek + sabah kumanya (örn. "29 + 29 kum") */
  oglenOrderLine: string | null;
  /** Akşam adet altı: akşam yemek + akşam kumanya */
  aksamOrderLine: string | null;
  /** Kumanya sütunu: gece yemek + tüm vardiya kumanya */
  kumanyaOrderLine: string | null;
};

function formatYemekPlusKum(yemek: number, kum: number): string | null {
  const y = Math.max(0, Math.floor(yemek));
  const k = Math.max(0, Math.floor(kum));
  if (y <= 0 && k <= 0) return null;
  if (y > 0 && k > 0) return `${y} + ${k} kum`;
  if (y > 0) return String(y);
  return `${k} kum`;
}

/** Kumanya sütunu: gece yemeği (grid mantığı) + saf kumanya kalemleri */
function formatKumanyaColumn(nightYemek: number, pureKumanya: number): string | null {
  const ny = Math.max(0, Math.floor(nightYemek));
  const pk = Math.max(0, Math.floor(pureKumanya));
  if (ny <= 0 && pk <= 0) return null;
  if (ny > 0 && pk > 0) return `${ny} + ${pk} kum`;
  if (ny > 0) return String(ny);
  return `${pk} kum`;
}

export function computeCompanyOrderGridHints(items: OrderItemForHint[]): CompanyOrderGridHints {
  let morningYemek = 0;
  let morningKum = 0;
  let eveningYemek = 0;
  let eveningKum = 0;
  let nightYemek = 0;
  let nightKum = 0;

  for (const it of items) {
    const q = it.quantity;
    if (q <= 0) continue;
    if (it.shift === "MORNING") {
      if (it.category === "OGLEN_YEMEGI") morningYemek += q;
      if (it.category === "KUMANYA") morningKum += q;
    } else if (it.shift === "EVENING") {
      if (it.category === "OGLEN_YEMEGI") eveningYemek += q;
      if (it.category === "KUMANYA") eveningKum += q;
    } else if (it.shift === "NIGHT") {
      if (it.category === "OGLEN_YEMEGI") nightYemek += q;
      if (it.category === "KUMANYA") nightKum += q;
    }
  }

  const pureKumanyaTotal = morningKum + eveningKum + nightKum;

  return {
    oglenOrderLine: formatYemekPlusKum(morningYemek, morningKum),
    aksamOrderLine: formatYemekPlusKum(eveningYemek, eveningKum),
    kumanyaOrderLine: formatKumanyaColumn(nightYemek, pureKumanyaTotal),
  };
}

export function mergeOrderHintsByCompany(
  entries: { companyId: string; items: OrderItemForHint[] }[],
): Map<string, CompanyOrderGridHints> {
  const map = new Map<string, OrderItemForHint[]>();
  for (const e of entries) {
    const cur = map.get(e.companyId) ?? [];
    cur.push(...e.items);
    map.set(e.companyId, cur);
  }
  const out = new Map<string, CompanyOrderGridHints>();
  for (const [companyId, allItems] of map) {
    out.set(companyId, computeCompanyOrderGridHints(allItems));
  }
  return out;
}
