"use client";

import { Copy } from "lucide-react";
import { signOut } from "next-auth/react";
import { MonthlyMenuCard } from "@/components/monthly-menu-card";

type Props = {
  showMenu: boolean;
  showRepeat: boolean;
  lastOrderSummary?: { dateLabel: string; itemsLine: string } | null;
  showUser: boolean;
  userName?: string | null;
  onRepeatLast: () => void | Promise<void>;
};

export function CustomerOrderHeader({
  showMenu,
  showRepeat,
  lastOrderSummary,
  showUser,
  userName,
  onRepeatLast,
}: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm ring-1 ring-slate-100/80 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">{showMenu ? <MonthlyMenuCard /> : null}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-end">
        {showRepeat ? (
          <button
            type="button"
            onClick={() => void onRepeatLast()}
            className="group inline-flex flex-col items-start gap-0.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.99] sm:max-w-xs"
            aria-label={
              lastOrderSummary
                ? `Geçen siparişi forma getir: ${lastOrderSummary.dateLabel}, ${lastOrderSummary.itemsLine}`
                : "Geçen siparişi forma getir"
            }
          >
            <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900">
              <Copy className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
              Geçen siparişi getir
            </span>
            {lastOrderSummary ? (
              <span className="text-[11px] font-medium leading-tight text-emerald-800/90">
                {lastOrderSummary.dateLabel} · {lastOrderSummary.itemsLine}
              </span>
            ) : null}
          </button>
        ) : null}
        {showUser && userName ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">
              {userName}
            </p>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-800"
            >
              Çıkış
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
