import type { ItemCategory, Shift } from "@prisma/client";

export type OrderItemForHint = {
  shift: Shift;
  category: ItemCategory;
  quantity: number;
};

export type CompanyOrderGridHints = {
  /** Öğle adet altı: sabah yemek + sabah kumanya (örn. "29 + 29 kum") */
  oglenOrderLine: string | null;
  /** Öğle ekmek altı: sabah ekmek arası + düz ekmek */
  oglenEkmekOrderLine: string | null;
  /** Akşam adet altı: akşam yemek + akşam kumanya */
  aksamOrderLine: string | null;
  /** Akşam ekmek altı: akşam/gece ekmek arası + düz ekmek */
  aksamEkmekOrderLine: string | null;
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

function formatEkmekColumn(ekmekArasi: number, duzEkmek: number): string | null {
  const ea = Math.max(0, Math.floor(ekmekArasi));
  const de = Math.max(0, Math.floor(duzEkmek));
  if (ea <= 0 && de <= 0) return null;
  if (ea > 0 && de > 0) return `${ea} arası + ${de} düz`;
  if (ea > 0) return `${ea} arası`;
  return `${de} düz`;
}

export function computeCompanyOrderGridHints(items: OrderItemForHint[]): CompanyOrderGridHints {
  let morningYemek = 0;
  let morningKum = 0;
  let eveningYemek = 0;
  let eveningKum = 0;
  let nightYemek = 0;
  let nightKum = 0;
  let morningEkmekArasi = 0;
  let morningDuzEkmek = 0;
  let eveningEkmekArasi = 0;
  let eveningDuzEkmek = 0;
  let nightEkmekArasi = 0;
  let nightDuzEkmek = 0;

  for (const it of items) {
    const q = it.quantity;
    if (q <= 0) continue;
    if (it.shift === "MORNING") {
      if (it.category === "OGLEN_YEMEGI") morningYemek += q;
      if (it.category === "KUMANYA") morningKum += q;
      if (it.category === "EKMEK_ARASI") morningEkmekArasi += q;
      if (it.category === "DUZ_EKMEK") morningDuzEkmek += q;
    } else if (it.shift === "EVENING") {
      if (it.category === "OGLEN_YEMEGI") eveningYemek += q;
      if (it.category === "KUMANYA") eveningKum += q;
      if (it.category === "EKMEK_ARASI") eveningEkmekArasi += q;
      if (it.category === "DUZ_EKMEK") eveningDuzEkmek += q;
    } else if (it.shift === "NIGHT") {
      if (it.category === "OGLEN_YEMEGI") nightYemek += q;
      if (it.category === "KUMANYA") nightKum += q;
      if (it.category === "EKMEK_ARASI") nightEkmekArasi += q;
      if (it.category === "DUZ_EKMEK") nightDuzEkmek += q;
    }
  }

  const pureKumanyaTotal = morningKum + eveningKum + nightKum;

  return {
    oglenOrderLine: formatYemekPlusKum(morningYemek, morningKum),
    oglenEkmekOrderLine: formatEkmekColumn(morningEkmekArasi, morningDuzEkmek),
    aksamOrderLine: formatYemekPlusKum(eveningYemek, eveningKum),
    aksamEkmekOrderLine: formatEkmekColumn(eveningEkmekArasi + nightEkmekArasi, eveningDuzEkmek + nightDuzEkmek),
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
