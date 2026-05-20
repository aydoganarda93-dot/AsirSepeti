import { ItemCategory } from "@prisma/client";
import { ALL_CATEGORIES } from "@/lib/categories";
import {
  emptyFormQuantities,
  type FormQuantities,
} from "@/lib/order-form";

export const QUICK_ORDER_TEXT_MAX = 2000;

export type ShiftKeyQuick = "morning" | "evening" | "night";

export type QuickOrderParseResult = {
  quantities: FormQuantities;
  appliedTokens: number;
  skippedHints: string[];
};

const SHIFT_WORDS: Record<string, ShiftKeyQuick> = {
  sabah: "morning",
  akşam: "evening",
  aksam: "evening",
  gece: "night",
};

const SINGLE_CATEGORY_WORDS: Record<string, ItemCategory> = {
  kumanya: "KUMANYA",
  yemek: "OGLEN_YEMEGI",
  öğün: "OGLEN_YEMEGI",
  ogun: "OGLEN_YEMEGI",
  öğle: "OGLEN_YEMEGI",
  ogle: "OGLEN_YEMEGI",
  öğlen: "OGLEN_YEMEGI",
  oglen: "OGLEN_YEMEGI",
  ekmek: "DUZ_EKMEK",
};

const TWO_WORD_CATEGORIES: Array<{ words: [string, string]; category: ItemCategory }> = [
  { words: ["ekmek", "arası"], category: "EKMEK_ARASI" },
  { words: ["ekmek", "arasi"], category: "EKMEK_ARASI" },
  { words: ["düz", "ekmek"], category: "DUZ_EKMEK" },
  { words: ["duz", "ekmek"], category: "DUZ_EKMEK" },
];

function normalize(raw: string): string {
  return raw
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function flushPending(
  quantities: FormQuantities,
  shift: ShiftKeyQuick,
  pending: number | null,
  category: ItemCategory | null,
): number {
  if (pending === null || pending <= 0) return 0;
  if (category) {
    quantities[shift][category] += pending;
    return 1;
  }
  for (const c of ALL_CATEGORIES) {
    quantities[shift][c] += pending;
  }
  return 1;
}

/**
 * Doğal dil hızlı sipariş: "sabah 20 yemek akşam 20 yemek" — virgül gerekmez.
 */
export function parseQuickOrderText(raw: string): QuickOrderParseResult {
  const skippedHints: string[] = [];
  const quantities = emptyFormQuantities();
  let appliedTokens = 0;

  const text = raw.slice(0, QUICK_ORDER_TEXT_MAX).trim();
  if (!text) {
    return { quantities, appliedTokens: 0, skippedHints };
  }

  const tokens = tokenize(text);
  let shift: ShiftKeyQuick = "morning";
  let pending: number | null = null;
  let pendingCategory: ItemCategory | null = null;

  const pushPending = () => {
    appliedTokens += flushPending(quantities, shift, pending, pendingCategory);
    pending = null;
    pendingCategory = null;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];

    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (!Number.isFinite(n) || n < 0 || n > 50_000) {
        skippedHints.push("Geçersiz sayı");
        continue;
      }
      pushPending();
      pending = n;
      continue;
    }

    const shiftHit = SHIFT_WORDS[t];
    if (shiftHit) {
      pushPending();
      shift = shiftHit;
      continue;
    }

    const twoKey = next ? `${t} ${next}` : "";
    const twoMatch = TWO_WORD_CATEGORIES.find(
      (entry) => entry.words[0] === t && entry.words[1] === next,
    );
    if (twoMatch) {
      pushPending();
      pendingCategory = twoMatch.category;
      i += 1;
      continue;
    }

    const cat = SINGLE_CATEGORY_WORDS[t];
    if (cat) {
      if (t === "ekmek" && next === "arası") {
        pushPending();
        pendingCategory = "EKMEK_ARASI";
        i += 1;
        continue;
      }
      pushPending();
      pendingCategory = cat;
      continue;
    }

    if (t.length > 1) {
      skippedHints.push(t);
    }
  }

  pushPending();

  return { quantities, appliedTokens, skippedHints };
}
