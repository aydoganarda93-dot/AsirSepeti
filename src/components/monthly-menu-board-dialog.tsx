"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  MonthlyMenuBoard,
  MonthlyMenuBoardError,
  MonthlyMenuBoardSkeleton,
} from "@/components/monthly-menu-board";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MonthlyMenuGridData } from "@/lib/monthly-menu-board";
import type { MonthlyMenuKind } from "@/lib/monthly-menu-constants";

type BoardApiXlsx = {
  kind: "xlsx";
  yearMonth: string;
  board: MonthlyMenuGridData;
};

type BoardApiPdf = {
  kind: "pdf";
  yearMonth: string;
  viewUrl: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  kind: MonthlyMenuKind;
};

export function MonthlyMenuBoardDialog({ open, onOpenChange, yearMonth, kind }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<MonthlyMenuGridData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !yearMonth) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setBoard(null);
    setPdfUrl(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/monthly-menu/board?yearMonth=${encodeURIComponent(yearMonth)}`,
        );
        if (!response.ok) {
          const json = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "Menü yüklenemedi");
        }
        const json = (await response.json()) as BoardApiXlsx | BoardApiPdf;
        if (cancelled) return;

        if (json.kind === "pdf") {
          setPdfUrl(json.viewUrl);
        } else {
          setBoard(json.board);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Menü yüklenemedi");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, yearMonth]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="fullscreen"
        className="flex h-[calc(100dvh-0.75rem)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.5rem)] max-w-[calc(100vw-0.5rem)] flex-col overflow-hidden p-0"
      >
        <DialogHeader className="relative shrink-0 border-b border-slate-100 px-3 py-2 pr-11 sm:px-4 sm:py-2.5">
          <DialogTitle className="text-base">
            {board?.title?.trim() || "Aylık menü"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {board?.monthLabel ?? yearMonth}
          </DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 sm:px-3">
          {loading ? <MonthlyMenuBoardSkeleton /> : null}
          {!loading && error ? <MonthlyMenuBoardError message={error} /> : null}
          {!loading && !error && board ? <MonthlyMenuBoard data={board} /> : null}
          {!loading && !error && pdfUrl ? (
            <iframe
              title="Aylık menü PDF"
              src={pdfUrl}
              className="h-full min-h-[calc(100dvh-5rem)] w-full rounded-lg border border-slate-200"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
