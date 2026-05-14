"use client";

import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MonthlyMenuPdfDialog } from "@/components/monthly-menu-pdf-dialog";
import { cn } from "@/lib/utils";

type MenuJson = {
  available: boolean;
  yearMonth?: string;
  configured?: boolean;
};

export function MonthlyMenuCard() {
  const [data, setData] = useState<MenuJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/monthly-menu");
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
  }, []);

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
  const available = Boolean(data?.available && yearMonth);

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
            <span className="block leading-tight">Aylık yemek menüsünü gör</span>
            <span className="text-[11px] font-normal text-slate-500">PDF önizleme</span>
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
      <MonthlyMenuPdfDialog open={dialogOpen} onOpenChange={setDialogOpen} yearMonth={yearMonth} />
    </>
  );
}
