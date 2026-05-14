"use client";

import { useEffect, useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { parseQuickOrderText } from "@/lib/parse-quick-order-text";
import { cn } from "@/lib/utils";

const SHIFTS = [
  { key: "morning" as const, label: "Sabah" },
  { key: "evening" as const, label: "Akşam" },
  { key: "night" as const, label: "Gece" },
];


type Props = {
  text: string;
  className?: string;
};

export function QuickOrderPreview({ text, className }: Props) {
  const [parsed, setParsed] = useState(() => parseQuickOrderText(""));

  useEffect(() => {
    const t = window.setTimeout(() => setParsed(parseQuickOrderText(text)), 320);
    return () => window.clearTimeout(t);
  }, [text]);

  const hasAny = SHIFTS.some((s) => ALL_CATEGORIES.some((c) => (parsed.quantities[s.key][c] ?? 0) > 0));

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 shadow-inner",
        className,
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Önizleme</p>
      {!text.trim() ? (
        <p className="text-xs text-slate-500">Hızlı giriş alanına yazdıkça burada özetlenir.</p>
      ) : !hasAny ? (
        <p className="text-xs text-slate-600">Bu metinden henüz adet çıkmadı; yazımı kontrol edin.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {SHIFTS.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-white bg-white/90 p-2 shadow-sm">
              <p className="mb-1.5 text-[11px] font-bold text-slate-800">{label}</p>
              <ul className="space-y-0.5 text-[11px] text-slate-700">
                {ALL_CATEGORIES.map((cat) => {
                  const n = parsed.quantities[key][cat] ?? 0;
                  if (n <= 0) return null;
                  return (
                    <li key={cat} className="tabular-nums">
                      {CATEGORY_LABELS[cat]}: <strong className="font-semibold">{n}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {parsed.skippedHints.length > 0 ? (
        <p className="mt-2 text-[10px] text-amber-800/90">
          Not: {parsed.skippedHints.slice(0, 2).join(" · ")}
          {parsed.skippedHints.length > 2 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}
