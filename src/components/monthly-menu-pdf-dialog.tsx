"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
};

export function MonthlyMenuPdfDialog({ open, onOpenChange, yearMonth }: Props) {
  const src =
    yearMonth.length > 0 ? `/api/monthly-menu/pdf?yearMonth=${encodeURIComponent(yearMonth)}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3">
          <DialogTitle>Aylık yemek menüsü</DialogTitle>
          <DialogDescription>PDF aynı oturumla güvenli şekilde yüklenir.</DialogDescription>
        </DialogHeader>
        {open && src ? (
          <iframe title="Aylık menü PDF" src={src} className="h-[80vh] w-full border-0 bg-slate-100" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
