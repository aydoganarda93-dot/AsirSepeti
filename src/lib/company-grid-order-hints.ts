import type { ItemCategory, Shift } from "@prisma/client";

export type OrderItemForHint = {
  shift: Shift;
  category: ItemCategory;
  quantity: number;
};

export type CompanyOrderGridHints = {
  oglenOrderLine: string | null;
  oglenEkmekOrderLine: string | null;
  oglenEkmekArasiOrderLine: string | null;
  oglenKumanyaOrderLine: string | null;
  aksamOrderLine: string | null;
  aksamEkmekOrderLine: string | null;
  aksamEkmekArasiOrderLine: string | null;
  aksamKumanyaOrderLine: string | null;
  geceOrderLine: string | null;
  geceEkmekOrderLine: string | null;
  geceKumanyaOrderLine: string | null;
};

function formatCount(n: number): string | null {
  const v = Math.max(0, Math.floor(n));
  return v > 0 ? String(v) : null;
}

/** Sütun başlığı kategori belirttiği için ipucu yalnızca sayı */
function formatCountOnly(n: number): string | null {
  return formatCount(n);
}

export function computeCompanyOrderGridHints(items: OrderItemForHint[]): CompanyOrderGridHints {
  let morningYemek = 0;
  let morningKum = 0;
  let morningDuzEkmek = 0;
  let morningEkmekArasi = 0;
  let eveningYemek = 0;
  let eveningKum = 0;
  let eveningDuzEkmek = 0;
  let eveningEkmekArasi = 0;
  let nightYemek = 0;
  let nightKum = 0;
  let nightDuzEkmek = 0;

  for (const it of items) {
    const q = it.quantity;
    if (q <= 0) continue;
    if (it.shift === "MORNING") {
      if (it.category === "OGLEN_YEMEGI") morningYemek += q;
      if (it.category === "KUMANYA") morningKum += q;
      if (it.category === "DUZ_EKMEK") morningDuzEkmek += q;
      if (it.category === "EKMEK_ARASI") morningEkmekArasi += q;
    } else if (it.shift === "EVENING") {
      if (it.category === "OGLEN_YEMEGI") eveningYemek += q;
      if (it.category === "KUMANYA") eveningKum += q;
      if (it.category === "DUZ_EKMEK") eveningDuzEkmek += q;
      if (it.category === "EKMEK_ARASI") eveningEkmekArasi += q;
    } else if (it.shift === "NIGHT") {
      if (it.category === "OGLEN_YEMEGI") nightYemek += q;
      if (it.category === "KUMANYA") nightKum += q;
      if (it.category === "DUZ_EKMEK") nightDuzEkmek += q;
    }
  }

  return {
    oglenOrderLine: formatCount(morningYemek),
    oglenEkmekOrderLine: formatCountOnly(morningDuzEkmek),
    oglenEkmekArasiOrderLine: formatCountOnly(morningEkmekArasi),
    oglenKumanyaOrderLine: formatCountOnly(morningKum),
    aksamOrderLine: formatCount(eveningYemek),
    aksamEkmekOrderLine: formatCountOnly(eveningDuzEkmek),
    aksamEkmekArasiOrderLine: formatCountOnly(eveningEkmekArasi),
    aksamKumanyaOrderLine: formatCountOnly(eveningKum),
    geceOrderLine: formatCount(nightYemek),
    geceEkmekOrderLine: formatCountOnly(nightDuzEkmek),
    geceKumanyaOrderLine: formatCountOnly(nightKum),
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
