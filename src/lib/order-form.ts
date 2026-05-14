import { ItemCategory, Shift } from "@prisma/client";
import { ALL_CATEGORIES } from "@/lib/categories";

const SHIFT_TO_KEY: Record<Shift, "morning" | "evening" | "night"> = {
  MORNING: "morning",
  EVENING: "evening",
  NIGHT: "night",
};

/** Bir vardiya satırındaki toplam kişi sayısı */
export function shiftTotal(row: Record<ItemCategory, number>): number {
  return ALL_CATEGORIES.reduce((s, c) => s + (row[c] ?? 0), 0);
}

/**
 * Özet satırından (tek toplam) kategori kırılımına yaz.
 * - Önceki dağılım sıfırsa: tümü **öğle yemeği** (OGLEN_YEMEGI) — fabrika öğünü varsayımı.
 * - Aksi halde: **en büyük kalanlı yöntem** ile oransal dağıtım (yuvarlama sonrası kalanları en yüksek kesirli kategorilere ekler).
 */
export function distributeShiftTarget(
  previous: Record<ItemCategory, number>,
  targetTotal: number,
): Record<ItemCategory, number> {
  const empty = emptyShiftQuantities();
  const n = Math.max(0, Math.floor(targetTotal));
  if (n === 0) return empty;

  const prevSum = shiftTotal(previous);
  if (prevSum <= 0) {
    empty.OGLEN_YEMEGI = n;
    return empty;
  }

  const exact = ALL_CATEGORIES.map((c) => ((previous[c] ?? 0) / prevSum) * n);
  const floors = exact.map((x) => Math.floor(x));
  const remainder = n - floors.reduce((a, b) => a + b, 0);
  const byFrac = ALL_CATEGORIES.map((c, i) => ({
    c,
    frac: exact[i] - floors[i],
  })).sort((a, b) => b.frac - a.frac);

  const out = { ...empty };
  ALL_CATEGORIES.forEach((c, i) => {
    out[c] = floors[i];
  });
  for (let r = 0; r < remainder; r += 1) {
    out[byFrac[r].c] += 1;
  }
  return out;
}

export function emptyShiftQuantities(): Record<ItemCategory, number> {
  return Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0])) as Record<ItemCategory, number>;
}

export function emptyFormQuantities() {
  return {
    morning: emptyShiftQuantities(),
    evening: emptyShiftQuantities(),
    night: emptyShiftQuantities(),
  };
}

export type FormQuantities = ReturnType<typeof emptyFormQuantities>;

export function orderItemsToFormQuantities(
  items: Array<{ shift: Shift; category: ItemCategory; quantity: number }>,
): FormQuantities {
  const q = emptyFormQuantities();
  for (const row of items) {
    const key = SHIFT_TO_KEY[row.shift];
    q[key][row.category] = row.quantity;
  }
  return q;
}
