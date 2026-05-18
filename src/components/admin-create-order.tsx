"use client";

import { ItemCategory } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { CompanyCombobox } from "@/components/company-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatUtcYmdFromOffset } from "@/lib/date";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string };

function emptyCategories(): Record<ItemCategory, number> {
  return {
    KUMANYA: 0,
    OGLEN_YEMEGI: 0,
    EKMEK_ARASI: 0,
    DUZ_EKMEK: 0,
  };
}

type ShiftState = {
  morning: Record<ItemCategory, number>;
  evening: Record<ItemCategory, number>;
  night: Record<ItemCategory, number>;
};

type Props = {
  companies: Company[];
  onCreated: () => void;
};

const SHIFT_ROWS: { key: keyof ShiftState; label: string }[] = [
  { key: "morning", label: "Sabah" },
  { key: "evening", label: "Akşam" },
  { key: "night", label: "Gece" },
];

/** Klavye / odak: mavi vurgu, kompakt hücre */
const cellInput =
  "h-8 w-full min-w-[3.25rem] rounded border border-slate-200 bg-white px-1.5 py-0 text-center text-sm tabular-nums text-slate-900 shadow-none outline-none transition-colors placeholder:text-slate-300 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0";

const headerField =
  "h-8 rounded border border-slate-200 bg-white px-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0";

export function AdminCreateOrder({ companies, onCreated }: Props) {
  const [companyId, setCompanyId] = useState("");
  const [contactName, setContactName] = useState("");
  const [notes, setNotes] = useState("");
  const [orderDate, setOrderDate] = useState(() => formatUtcYmdFromOffset(0));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<ShiftState>({
    morning: emptyCategories(),
    evening: emptyCategories(),
    night: emptyCategories(),
  });
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const firstCompanyId = companies[0]?.id ?? "";
  const resolvedCompanyId = useMemo(
    () => (companies.some((c) => c.id === companyId) ? companyId : firstCompanyId),
    [companies, companyId, firstCompanyId],
  );

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
  }, [notes]);

  function updateQuantity(shift: keyof ShiftState, category: ItemCategory, nextValue: number) {
    setQuantities((prev) => ({
      ...prev,
      [shift]: {
        ...prev[shift],
        [category]: Math.max(0, nextValue),
      },
    }));
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:space-y-2.5 md:p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: resolvedCompanyId,
            contactName,
            orderDate,
            notes: notes.trim() || undefined,
            quantities,
          }),
        });
        setSubmitting(false);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
          const apiMessage =
            typeof payload?.error === "string" ? payload.error : "Manuel sipariş kaydedilemedi.";
          setError(apiMessage);
          return;
        }
        setContactName("");
        setNotes("");
        setQuantities({
          morning: emptyCategories(),
          evening: emptyCategories(),
          night: emptyCategories(),
        });
        onCreated();
      }}
    >
      {/* İnce üst şerit */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5 border-b border-slate-200 pb-2">
        <div className="min-w-[min(100%,12rem)] flex-[2]">
          <CompanyCombobox
            companies={companies}
            value={resolvedCompanyId}
            onChange={setCompanyId}
            disabled={submitting}
            dense
            inputId="manual-order-company"
            inputClassName={cn(
              "h-8 rounded-md text-sm",
              "focus-visible:border-blue-600 focus-visible:ring-blue-500/40",
            )}
          />
        </div>
        <div className="w-[min(100%,10rem)] shrink-0">
          <label htmlFor="manual-order-contact" className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            İletişim
          </label>
          <Input
            id="manual-order-contact"
            placeholder="Ad soyad"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            disabled={submitting}
            className={headerField}
          />
        </div>
        <div className="w-[min(100%,9.5rem)] shrink-0">
          <label htmlFor="manual-order-date" className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Tarih
          </label>
          <Input
            id="manual-order-date"
            type="date"
            min={formatUtcYmdFromOffset(0)}
            max={formatUtcYmdFromOffset(365)}
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            disabled={submitting}
            className={headerField}
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-500">Tab ile hücreler arasında ilerleyin; rakam yazıp Enter veya Tab kullanın.</p>

      {/* Tablo gövdesi — öğün satırı × Kumanya / Yemek / Ekmek */}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50/40">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-white">
              <th
                scope="col"
                className="sticky left-0 z-[1] border-r border-slate-200 bg-slate-100 py-1 pl-2 pr-2 text-left text-[11px] font-semibold text-slate-600 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
              >
                Öğün
              </th>
              {ALL_CATEGORIES.map((category) => (
                <th
                  key={category}
                  scope="col"
                  className="border-l border-slate-200 bg-slate-100 px-1 py-1 text-center text-[11px] font-semibold text-slate-600"
                >
                  {CATEGORY_LABELS[category]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFT_ROWS.map(({ key: shift, label }) => (
              <tr key={shift} className="border-b border-slate-200 last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-[1] whitespace-nowrap border-r border-slate-200 bg-white py-0.5 pl-2 pr-2 text-left text-xs font-semibold text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                >
                  {label}
                </th>
                {ALL_CATEGORIES.map((category) => {
                  const id = `q-${shift}-${category}`;
                  const v = quantities[shift][category];
                  return (
                    <td key={category} className="border-l border-slate-200 p-0.5">
                      <input
                        id={id}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        disabled={submitting}
                        value={v}
                        aria-label={`${label} ${CATEGORY_LABELS[category]} adedi`}
                        onChange={(e) => updateQuantity(shift, category, Math.max(0, Number(e.target.value) || 0))}
                        onFocus={(e) => e.currentTarget.select()}
                        className={cellInput}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-0.5">
        <label htmlFor="manual-order-notes" className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Not <span className="normal-case text-slate-400">(isteğe bağlı)</span>
        </label>
        <Textarea
          ref={notesRef}
          id="manual-order-notes"
          rows={2}
          placeholder="Kısa not"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          disabled={submitting}
          className={cn(
            "min-h-[44px] resize-none overflow-hidden rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm leading-snug",
            "placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0",
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2 sm:flex-row sm:items-center sm:justify-end">
        {error ? (
          <p className="text-xs text-red-700 sm:order-first sm:mr-auto" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={submitting}
          variant="outline"
          size="sm"
          className="h-9 w-full shrink-0 border-slate-300 font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
              Kaydediliyor…
            </>
          ) : (
            "Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}
