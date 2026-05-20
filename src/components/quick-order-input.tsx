"use client";

import { Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FormQuantities } from "@/lib/order-form";
import { parseQuickOrderText, QUICK_ORDER_TEXT_MAX } from "@/lib/parse-quick-order-text";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  onApplyQuantities: (quantities: FormQuantities) => void;
  onAppendNotes?: (text: string) => void;
  /** Önizleme vb. için ham metin */
  onTextChange?: (text: string) => void;
  /** Otomatik veya elle uygulama sonrası — forma görsel vurgu için */
  onApplied?: () => void;
};

const PLACEHOLDER = `Örnek: sabah 40 yemek akşam 25 kumanya gece 12 ekmek
Virgül koymak zorunda değilsiniz; yazmayı bıraktığınızda adetler otomatik güncellenir.`;

const DEBOUNCE_MS = 480;

export function QuickOrderInput({
  disabled,
  onApplyQuantities,
  onAppendNotes,
  onApplied,
  onTextChange,
}: Props) {
  const [text, setText] = useState("");
  const [copyToNotes, setCopyToNotes] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const lastAppliedRef = useRef<string>("");
  const timerRef = useRef<number | undefined>(undefined);
  const onApplyQuantitiesRef = useRef(onApplyQuantities);
  const onAppliedRef = useRef(onApplied);

  useEffect(() => {
    onApplyQuantitiesRef.current = onApplyQuantities;
    onAppliedRef.current = onApplied;
  }, [onApplyQuantities, onApplied]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!disabled) return;
    clearTimer();
  }, [disabled, clearTimer]);

  const scheduleParse = useCallback(
    (nextText: string) => {
      clearTimer();
      if (disabled) {
        setIsParsing(false);
        return;
      }
      const trimmed = nextText.trim();
      if (!trimmed) {
        setIsParsing(false);
        return;
      }
      setIsParsing(true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        const result = parseQuickOrderText(trimmed);
        setIsParsing(false);
        if (result.appliedTokens === 0) {
          return;
        }
        const sig = `${trimmed}::${JSON.stringify(result.quantities)}`;
        if (sig === lastAppliedRef.current) return;
        lastAppliedRef.current = sig;
        onApplyQuantitiesRef.current(result.quantities);
        onAppliedRef.current?.();
      }, DEBOUNCE_MS);
    },
    [clearTimer, disabled],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  function handleApplyNow() {
    clearTimer();
    setIsParsing(false);
    const trimmed = text.trim();
    if (!trimmed) {
      toast.message("Önce metin yazın.");
      return;
    }
    const result = parseQuickOrderText(trimmed);
    if (result.appliedTokens === 0) {
      toast.error("Bu metinden adet çıkaramadık. Rakam ve kelimeleri kontrol edin.");
      if (result.skippedHints.length > 0) {
        toast.message(`Atlanan: ${result.skippedHints.slice(0, 2).join(" · ")}`, { duration: 4000 });
      }
      return;
    }
    lastAppliedRef.current = `${trimmed}::${JSON.stringify(result.quantities)}`;
    onApplyQuantities(result.quantities);
    if (copyToNotes && onAppendNotes) {
      onAppendNotes(trimmed.slice(0, QUICK_ORDER_TEXT_MAX));
    }
    onApplied?.();
    toast.success(`${result.appliedTokens} kural forma işlendi.`);
  }

  function handleClear() {
    clearTimer();
    setIsParsing(false);
    setText("");
    lastAppliedRef.current = "";
    onTextChange?.("");
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-emerald-200/90 bg-gradient-to-br from-white via-emerald-50/40 to-white p-4 shadow-md shadow-emerald-900/5 ring-1 ring-emerald-100/80 md:p-5",
        isParsing && !disabled && text.trim().length > 0 && "ring-2 ring-emerald-300/60",
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-200/20 blur-2xl" />
      <div className="relative mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
          <Wand2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="flex items-center gap-2 text-base font-bold tracking-tight text-emerald-950">
            Akıllı sipariş yazımı
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
          </p>
          <p className="mt-0.5 text-sm leading-snug text-emerald-900/85">
            WhatsApp’taki gibi yazın; yazmayı bıraktığınızda adetler <strong className="font-semibold">otomatik</strong>{" "}
            güncellenir.
          </p>
        </div>
      </div>

      <label className="sr-only" htmlFor="quick-order-textarea">
        Hızlı sipariş metni
      </label>
      <textarea
        id="quick-order-textarea"
        value={text}
        onChange={(e) => {
          const v = e.target.value.slice(0, QUICK_ORDER_TEXT_MAX);
          setText(v);
          onTextChange?.(v);
          scheduleParse(v);
        }}
        disabled={disabled}
        rows={5}
        maxLength={QUICK_ORDER_TEXT_MAX}
        placeholder={PLACEHOLDER}
        className="relative w-full resize-y rounded-xl border border-emerald-200/80 bg-white/90 p-3.5 text-base leading-relaxed outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 md:text-sm"
      />

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-emerald-900">
          <input
            type="checkbox"
            checked={copyToNotes}
            onChange={(e) => setCopyToNotes(e.target.checked)}
            className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
            disabled={disabled}
          />
          Metni not alanına da ekle
        </label>
        <span className="text-[11px] font-medium text-emerald-800/70">
          {text.length} / {QUICK_ORDER_TEXT_MAX}
          {isParsing && !disabled && text.trim() ? <span className="ml-2 text-emerald-600"> · okunuyor…</span> : null}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleApplyNow()}
          className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
        >
          Şimdi uygula
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleClear}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Temizle
        </button>
      </div>
    </div>
  );
}
