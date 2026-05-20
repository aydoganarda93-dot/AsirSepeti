"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MonthlyMenuKind } from "@/lib/monthly-menu-constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  kind?: MonthlyMenuKind;
};

function menuFileSrc(yearMonth: string) {
  return yearMonth.length > 0
    ? `/api/monthly-menu/file?yearMonth=${encodeURIComponent(yearMonth)}`
    : "";
}

function MonthlyMenuXlsxPreview({ src }: { src: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setHtml(null);

    void (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("fetch_failed");
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("no_sheet");
        const sheet = workbook.Sheets[sheetName];
        const tableHtml = XLSX.utils.sheet_to_html(sheet, { id: "monthly-menu-sheet" });
        if (!cancelled) setHtml(tableHtml);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Excel yükleniyor…
      </div>
    );
  }

  if (error || !html) {
    return (
      <p className="px-4 py-8 text-center text-sm text-red-700">
        Excel önizlemesi açılamadı. Dosyayı indirmek için yöneticinizle paylaşılan bağlantıyı kullanın.
      </p>
    );
  }

  return (
    <div
      className="monthly-menu-xlsx-preview h-[80vh] overflow-auto bg-white px-2 py-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MonthlyMenuPdfDialog({ open, onOpenChange, yearMonth, kind = "pdf" }: Props) {
  const src = menuFileSrc(yearMonth);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3">
          <DialogTitle>Aylık yemek menüsü</DialogTitle>
          <DialogDescription>
            {kind === "xlsx"
              ? "Excel dosyası güvenli oturumla yüklenir."
              : "PDF aynı oturumla güvenli şekilde yüklenir."}
          </DialogDescription>
        </DialogHeader>
        {open && src ? (
          kind === "xlsx" ? (
            <MonthlyMenuXlsxPreview src={src} />
          ) : (
            <iframe title="Aylık menü PDF" src={src} className="h-[80vh] w-full border-0 bg-slate-100" />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
