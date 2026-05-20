"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MonthlyMenuBoardDialog } from "@/components/monthly-menu-board-dialog";
import { formatYearMonthTr, yearMonthFromOrderDate } from "@/lib/date";
import type { MonthlyMenuKind } from "@/lib/monthly-menu-constants";
import { cn } from "@/lib/utils";

type MenuJson = {
  available: boolean;
  yearMonth?: string;
  requestedYearMonth?: string;
  kind?: MonthlyMenuKind;
  configured?: boolean;
};

type Props = {
  /** Sipariş formundaki teslimat tarihi (`yyyy-MM-dd`); menü ayı buna göre istenir. */
  orderDateYmd?: string;
};

export function MonthlyMenuCard({ orderDateYmd }: Props) {
  const [data, setData] = useState<MenuJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const ym = yearMonthFromOrderDate(orderDateYmd);
        const qs = ym ? `?yearMonth=${encodeURIComponent(ym)}` : "";
        const response = await fetch(`/api/monthly-menu${qs}`);
        if (response.status === 401) {
          if (!cancelled) setData({ available: false });
          return;
        }
        const json = (await response.json()) as MenuJson;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ available: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderDateYmd]);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-600 shadow-sm"
        aria-busy
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Menü kontrol ediliyor…
      </div>
    );
  }

  const yearMonth = data?.yearMonth ?? "";
  const menuKind = data?.kind ?? "pdf";
  const available = Boolean(data?.available && yearMonth);
  const monthNote =
    available &&
    data?.requestedYearMonth &&
    data.requestedYearMonth !== yearMonth
      ? formatYearMonthTr(yearMonth)
      : null;

  return (
    <>
      {available ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-50 md:inline-flex md:w-auto md:justify-start",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block leading-tight">Aylık menüyü gör</span>
            <span className="text-[11px] font-normal text-slate-500">
              {monthNote ? `${monthNote} menüsü` : menuKind === "xlsx" ? "Excel tablosu" : "PDF dosyası"}
            </span>
          </span>
        </button>
      ) : (
        <div
          className={cn(
            "rounded-xl border px-3 py-2 text-xs leading-snug shadow-sm",
            data?.configured === false
              ? "border-slate-200 bg-slate-50 text-slate-600"
              : "border-amber-200/90 bg-amber-50/90 text-amber-950",
          )}
          role="status"
        >
          {data?.configured === false
            ? "Aylık menü dosyası sunucuda henüz yapılandırılmadı. Menü yüklemesi için yöneticinize danışabilirsiniz."
            : "Bu ayın menüsü henüz yüklenmedi."}
        </div>
      )}
      <MonthlyMenuBoardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        yearMonth={yearMonth}
        kind={menuKind}
      />
    </>
  );
}
