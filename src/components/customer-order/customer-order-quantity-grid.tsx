"use client";

import type { ItemCategory } from "@prisma/client";
import { Moon, Sun, Sunset } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type ShiftKey = "morning" | "evening" | "night";

const SHIFT_BLOCKS: {
  key: ShiftKey;
  title: string;
  subtitle: string;
  Icon: typeof Sun;
  headerClass: string;
}[] = [
  {
    key: "morning",
    title: "Sabah",
    subtitle: "Sabah siparişi",
    Icon: Sun,
    headerClass: "from-amber-50 to-orange-50/80 text-amber-950 border-amber-100",
  },
  {
    key: "evening",
    title: "Akşam",
    subtitle: "Akşam siparişi",
    Icon: Sunset,
    headerClass: "from-orange-50 to-rose-50/70 text-orange-950 border-orange-100",
  },
  {
    key: "night",
    title: "Gece",
    subtitle: "Gece siparişi",
    Icon: Moon,
    headerClass: "from-slate-100 to-indigo-50/90 text-slate-900 border-slate-200",
  },
];

const CATEGORY_HINTS: Record<ItemCategory, string> = {
  KUMANYA: "Sık aralık: 10–80",
  OGLEN_YEMEGI: "Sık aralık: 30–150",
  EKMEK_ARASI: "Çoğu işletme: 80–120",
};

function QuickQtyPopover({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200/80 bg-white text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-40"
        aria-expanded={open}
        aria-label="Hızlı adet ekle"
      >
        +
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 flex gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur-sm">
          {([10, 50] as const).map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => {
                onAdd(n);
                setOpen(false);
              }}
              className="rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2 py-1 text-[11px] font-bold tabular-nums text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
            >
              +{n}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  form: UseFormReturn<Record<string, unknown>>;
  disabled: boolean;
  qtyHighlight: boolean;
  onAddToCell: (shift: ShiftKey, category: ItemCategory, delta: number) => void;
};

export function CustomerOrderQuantityGrid({ form, disabled, qtyHighlight, onAddToCell }: Props) {
  const { register } = form;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-100 bg-slate-50/40 p-3 transition-shadow duration-300 md:p-4",
        qtyHighlight && "shadow-md shadow-emerald-200/50 ring-2 ring-emerald-300/60",
      )}
    >
      <p className="mb-3 text-sm font-bold text-slate-800">Adetler</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {SHIFT_BLOCKS.map(({ key: shift, title, subtitle, Icon, headerClass }) => (
          <section
            key={shift}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
          >
            <div
              className={cn(
                "flex items-center gap-3 border-b bg-gradient-to-r px-3 py-2.5 md:px-4",
                headerClass,
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-black/5">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{title}</p>
                <p className="text-[11px] font-medium opacity-80">{subtitle}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-1 sm:p-4">
              {ALL_CATEGORIES.map((category) => (
                <div
                  key={`${shift}-${category}`}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5"
                >
                  <span className="mb-0.5 block text-xs font-semibold text-slate-800">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <p className="mb-1.5 text-[10px] text-slate-500">{CATEGORY_HINTS[category]}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      disabled={disabled}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-center text-lg font-semibold tabular-nums text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      {...register(`quantities.${shift}.${category}`, { valueAsNumber: true })}
                    />
                    <QuickQtyPopover
                      disabled={disabled}
                      onAdd={(n) => onAddToCell(shift, category, n)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
