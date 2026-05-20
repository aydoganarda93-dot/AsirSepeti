"use client";

import type { ItemCategory } from "@prisma/client";
import { Moon, Sun, Sunset } from "lucide-react";
import { Controller, type UseFormReturn } from "react-hook-form";
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
  DUZ_EKMEK: "Ekmek adedi",
};

const qtyStepBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200/80 bg-white text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-40";

/** Tarayıcı varsayılan number oklarını gizle; − / + stepper kullanılıyor */
const qtyInputClass =
  "min-w-0 flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-center text-lg font-semibold tabular-nums text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 [-moz-appearance:textfield] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function QuickQtyStepper({
  disabled,
  onDelta,
}: {
  disabled: boolean;
  onDelta: (delta: number) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelta(-1)}
        className={qtyStepBtn}
        aria-label="1 adet azalt"
      >
        −
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelta(1)}
        className={qtyStepBtn}
        aria-label="1 adet artır"
      >
        +
      </button>
    </div>
  );
}

type Props = {
  form: UseFormReturn<Record<string, unknown>>;
  disabled: boolean;
  qtyHighlight: boolean;
  onAddToCell: (shift: ShiftKey, category: ItemCategory, delta: number) => void;
};

function qtyInputDisplay(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n);
}

function parseQtyInput(raw: string): number {
  if (raw === "") return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function CustomerOrderQuantityGrid({ form, disabled, qtyHighlight, onAddToCell }: Props) {
  const { control } = form;

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
                    <Controller
                      name={`quantities.${shift}.${category}`}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          placeholder="0"
                          disabled={disabled}
                          className={qtyInputClass}
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={qtyInputDisplay(field.value)}
                          onChange={(e) => field.onChange(parseQtyInput(e.target.value))}
                        />
                      )}
                    />
                    <QuickQtyStepper
                      disabled={disabled}
                      onDelta={(delta) => onAddToCell(shift, category, delta)}
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
