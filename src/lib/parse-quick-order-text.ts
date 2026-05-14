import { ItemCategory } from "@prisma/client";
import { ALL_CATEGORIES } from "@/lib/categories";
import {
  distributeShiftTarget,
  emptyFormQuantities,
  emptyShiftQuantities,
  type FormQuantities,
} from "@/lib/order-form";

/** Sipariş amaçlı metin üst sınırı (not alanı ile uyumlu) */
export const QUICK_ORDER_TEXT_MAX = 2000;

export type ShiftKeyQuick = "morning" | "evening" | "night";

export type QuickOrderParseResult = {
  quantities: FormQuantities;
  /** Kaç adet sayı satıra işlendi */
  appliedTokens: number;
  /** Anlaşılamayan parça özetleri (çökmez; kullanıcı manuel girer) */
  skippedHints: string[];
};

function padWords(s: string): string {
  return ` ${s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim()} `;
}

function detectShiftExplicit(padded: string): ShiftKeyQuick | null {
  if (padded.includes(" akşam ") || padded.includes(" aksam ")) return "evening";
  if (padded.includes(" gece ")) return "night";
  if (padded.includes(" sabah ")) return "morning";
  return null;
}

/** Kumanya / yemek / ekmek — null ise vardiya toplamı (öğüne dağıtılır) */
function detectCategory(padded: string): ItemCategory | null {
  if (padded.includes(" kumanya ")) return "KUMANYA";
  if (padded.includes(" ekmek arası ") || padded.includes(" ekmek arasi ")) return "EKMEK_ARASI";
  if (padded.includes(" ekmek ") && !padded.includes(" yemek ")) return "EKMEK_ARASI";
  if (
    padded.includes(" yemek ") ||
    padded.includes(" öğün ") ||
    padded.includes(" öğle ") ||
    padded.includes(" öğlen ") ||
    padded.includes(" ogun ") ||
    padded.includes(" ogle ")
  ) {
    return "OGLEN_YEMEGI";
  }
  return null;
}

function mergeShiftRow(target: Record<ItemCategory, number>, addition: Record<ItemCategory, number>) {
  for (const c of ALL_CATEGORIES) {
    target[c] += addition[c] ?? 0;
  }
}

/**
 * WhatsApp tarzı metinden adet çıkarır. Kurallar bilinçli olarak dar tutuldu;
 * anlaşılmayan satırlar atlanır (skippedHints), form çökmez.
 */
export function parseQuickOrderText(raw: string): QuickOrderParseResult {
  const skippedHints: string[] = [];
  const quantities = emptyFormQuantities();
  let appliedTokens = 0;

  const text = raw.slice(0, QUICK_ORDER_TEXT_MAX).trim();
  if (!text) {
    return { quantities, appliedTokens: 0, skippedHints };
  }

  const clauses = text.split(/[\n.;]+/).map((c) => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    const nums = [...clause.matchAll(/(\d+)/g)];
    if (nums.length === 0) {
      skippedHints.push(clause.length > 40 ? `${clause.slice(0, 37)}…` : clause);
      continue;
    }

    let inheritedShift: ShiftKeyQuick = "morning";

    for (let i = 0; i < nums.length; i += 1) {
      const m = nums[i];
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n) || n < 0 || n > 50_000) {
        skippedHints.push("Geçersiz sayı");
        continue;
      }

      const prevEnd = i > 0 ? (nums[i - 1].index ?? 0) + nums[i - 1][1].length : 0;
      const nextStart =
        i < nums.length - 1 ? (nums[i + 1].index ?? clause.length) : clause.length;
      const ctx = clause.slice(prevEnd, nextStart);
      const padded = padWords(ctx);

      const explicitShift = detectShiftExplicit(padded);
      const shift = explicitShift ?? inheritedShift;
      if (explicitShift) inheritedShift = explicitShift;

      const cat = detectCategory(padded);

      if (cat) {
        quantities[shift][cat] += n;
        appliedTokens += 1;
      } else {
        const row = distributeShiftTarget(emptyShiftQuantities(), n);
        mergeShiftRow(quantities[shift], row);
        appliedTokens += 1;
      }
    }
  }

  return { quantities, appliedTokens, skippedHints };
}
