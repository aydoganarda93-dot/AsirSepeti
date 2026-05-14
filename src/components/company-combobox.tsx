"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CompanyOption = { id: string; name: string };

type Props = {
  companies: CompanyOption[];
  value: string;
  onChange: (companyId: string) => void;
  disabled?: boolean;
  label?: string;
  /** Ek sınıflar — Input ile birleştirilir (twMerge) */
  inputClassName?: string;
  /** Dar üst şerit için daha sıkı dikey boşluk */
  dense?: boolean;
  /** Input ve label `htmlFor` eşlemesi */
  inputId?: string;
};

export function CompanyCombobox({
  companies,
  value,
  onChange,
  disabled,
  label = "İşletme",
  inputClassName,
  dense,
  inputId: inputIdProp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => companies.find((c) => c.id === value), [companies, value]);

  const closedLabel = selected?.name ?? "";
  const inputValue = open ? query : closedLabel;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return companies.slice(0, 40);
    return companies.filter((c) => c.name.toLocaleLowerCase("tr").includes(q)).slice(0, 50);
  }, [companies, query]);

  const maxIdx = Math.max(filtered.length - 1, 0);
  const safeHighlight = Math.min(highlight, maxIdx);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-idx="${safeHighlight}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [safeHighlight, open]);

  function pick(c: CompanyOption) {
    onChange(c.id);
    setQuery(c.name);
    setOpen(false);
  }

  const inputId = inputIdProp ?? "company-combobox-input";

  return (
    <div ref={wrapRef} className={cn("relative", dense ? "space-y-0.5" : "space-y-1.5")}>
      <label htmlFor={inputId} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      <Input
        disabled={disabled}
        value={inputValue}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="company-combobox-list"
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(closedLabel);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setQuery(closedLabel);
              setHighlight(0);
              return;
            }
            setHighlight((h) => Math.min(h + 1, maxIdx));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setQuery(closedLabel);
              setHighlight(0);
              return;
            }
            setHighlight((h) => Math.max(h - 1, 0));
            return;
          }
          if (e.key === "Enter") {
            const choice = filtered[safeHighlight];
            if (open && choice) {
              e.preventDefault();
              pick(choice);
            }
          }
        }}
        placeholder="İşletme ara veya seç…"
        autoComplete="off"
        id={inputId}
        className={cn(
          "rounded-xl border-slate-200 bg-white transition-shadow placeholder:text-slate-400",
          "focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/35",
          inputClassName,
        )}
      />
      {open && filtered.length > 0 ? (
        <ul
          ref={listRef}
          id="company-combobox-list"
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-lg ring-1 ring-slate-900/5"
        >
          {filtered.map((c, idx) => (
            <li key={c.id} role="option" aria-selected={idx === safeHighlight}>
              <button
                type="button"
                data-idx={idx}
                className={cn(
                  "w-full px-3 py-2.5 text-left text-sm transition-colors",
                  idx === safeHighlight ? "bg-emerald-50 text-emerald-950" : "text-slate-800 hover:bg-slate-50",
                )}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(c)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && filtered.length === 0 ? (
        <p className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-lg ring-1 ring-slate-900/5">
          Eşleşen işletme yok. Yazmaya devam edin veya listeden seçin.
        </p>
      ) : null}
    </div>
  );
}
