"use client";

import { ItemCategory, OrderKind, OrderStatus, Shift } from "@prisma/client";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Check, Eye, X } from "lucide-react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { AdminOrder } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  orders: AdminOrder[];
  selectedOrderIds: string[];
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectOne: (orderId: string, checked: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewDetail: (order: AdminOrder) => void;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  READY: "Hazır",
  DELIVERED: "Teslim Edildi",
};

const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: "Sabah",
  EVENING: "Akşam",
  NIGHT: "Gece",
};

function statusBadgeVariant(status: OrderStatus): "warning" | "success" | "secondary" | "destructive" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "CONFIRMED":
    case "DELIVERED":
      return "success";
    case "PREPARING":
    case "READY":
      return "secondary";
    default:
      return "secondary";
  }
}

function getQty(order: AdminOrder, category: ItemCategory, shift: Shift) {
  return order.items.find((item) => item.category === category && item.shift === shift)?.quantity ?? 0;
}

function totalPortions(order: AdminOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function ApprovalEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-8 py-16 text-center">
      <div className="relative" aria-hidden>
        <svg width="160" height="140" viewBox="0 0 160 140" className="text-slate-200">
          <rect x="24" y="28" width="112" height="88" rx="12" fill="currentColor" className="text-slate-100" />
          <rect x="36" y="42" width="88" height="8" rx="4" fill="#cbd5e1" />
          <rect x="36" y="58" width="64" height="8" rx="4" fill="#e2e8f0" />
          <rect x="36" y="74" width="72" height="8" rx="4" fill="#e2e8f0" />
          <circle cx="118" cy="52" r="22" fill="#fff" stroke="#94a3b8" strokeWidth="2" />
          <path
            d="M108 52 L114 58 L128 42"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="max-w-sm space-y-2">
        <p className="text-lg font-semibold tracking-tight text-slate-900">Tüm işler tamam!</p>
        <p className="text-sm leading-relaxed text-slate-500">
          Şu an onay bekleyen sipariş yok. Yeni talepler geldiğinde burada listelenir; bildirim veya mutfak ekranınızı
          takip etmeye devam edin.
        </p>
      </div>
    </div>
  );
}

export function AdminOrdersTable({
  orders,
  selectedOrderIds,
  onToggleSelectAll,
  onToggleSelectOne,
  onApprove,
  onReject,
  onViewDetail,
}: Props) {
  const allSelected = orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order.id));

  if (orders.length === 0) {
    return <ApprovalEmptyState />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50/90 hover:bg-slate-50/90">
              <TableHead className="w-11 text-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  checked={allSelected}
                  onChange={(event) => onToggleSelectAll(event.currentTarget.checked)}
                  aria-label="Tüm siparişleri seç"
                />
              </TableHead>
              <TableHead className="min-w-[200px] font-semibold text-slate-700">Firma</TableHead>
              <TableHead className="whitespace-nowrap font-semibold text-slate-700">Sipariş saati</TableHead>
              {ALL_CATEGORIES.map((category) => (
                <TableHead key={category} className="min-w-[140px] font-semibold text-slate-700">
                  {CATEGORY_LABELS[category]}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap font-semibold text-slate-700">Durum</TableHead>
              <TableHead className="w-12 text-center font-semibold text-slate-700">Detay</TableHead>
              <TableHead className="w-[104px] text-right font-semibold text-slate-700">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order, index) => (
              <TableRow
                key={order.id}
                className={cn(
                  "group border-b border-slate-100 align-top transition-colors hover:bg-slate-50/80",
                  index % 2 === 1 ? "bg-slate-50/40" : "bg-white",
                )}
              >
                <TableCell className="py-3 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={selectedOrderIds.includes(order.id)}
                    onChange={(event) => onToggleSelectOne(order.id, event.currentTarget.checked)}
                    aria-label={`${order.company.name} siparişini seç`}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold leading-snug tracking-tight text-slate-900">{order.company.name}</p>
                    {order.kind === OrderKind.SUPPLEMENT ? (
                      <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">
                        Üzerine ek
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{order.contactName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Toplam <span className="font-medium text-slate-600">{totalPortions(order)}</span> porsiyon
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap py-3 text-sm text-slate-600">
                  {format(parseISO(order.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                </TableCell>
                {ALL_CATEGORIES.map((category) => (
                  <TableCell key={`${order.id}-${category}`} className="py-3">
                    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-1.5 text-xs">
                      {(["MORNING", "EVENING", "NIGHT"] as const).map((shift) => (
                        <span key={shift} className="font-medium text-slate-700">
                          {SHIFT_LABELS[shift]}: {getQty(order, category, shift)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                ))}
                <TableCell className="py-3">
                  <Badge variant={statusBadgeVariant(order.status)} className="font-semibold">
                    {STATUS_LABELS[order.status]}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Sipariş detayı"
                    onClick={() => onViewDetail(order)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      aria-label="Onayla"
                      onClick={() => onApprove(order.id)}
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      aria-label="Reddet"
                      onClick={() => onReject(order.id)}
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
