"use client";

import { OrderKind, OrderStatus } from "@prisma/client";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronDown, ChevronRight, Pencil, PlusCircle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { MyOrderRow } from "@/components/customer-orders-panel";
import { CATEGORY_LABELS, SHIFT_LABELS } from "@/lib/categories";
import { cn } from "@/lib/utils";

const STATUS_UI: Record<OrderStatus, string> = {
  PENDING: "İşletmede onayda",
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  READY: "Hazır",
  DELIVERED: "Teslim edildi",
};

const RECENT_ORDER_LIMIT = 8;

function orderTotalPeople(items: MyOrderRow["items"]) {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function formatOrderDate(iso: string) {
  try {
    return format(parseISO(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`), "d MMM", { locale: tr });
  } catch {
    return iso;
  }
}

type Props = {
  orders: MyOrderRow[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onEdit: (order: MyOrderRow) => void;
  onSupplement: () => void;
  activeEditingId: string | null;
  extraOrderMode: boolean;
};

export function CustomerOrderHistorySlim({
  orders,
  isLoading,
  isError,
  onRefetch,
  onEdit,
  onSupplement,
  activeEditingId,
  extraOrderMode,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, RECENT_ORDER_LIMIT);
  }, [orders]);

  const hiddenOlderCount = Math.max(0, orders.length - RECENT_ORDER_LIMIT);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100/80">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <h2 className="text-sm font-bold text-slate-900">Son siparişlerim</h2>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onRefetch()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Yenile"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSupplement()}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2 text-[11px] font-semibold text-white hover:bg-emerald-800"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Üzerine ek
          </button>
        </div>
      </div>

      {extraOrderMode ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
          Ek adet modu: yalnızca eklemek istediklerinizi yazın.
        </p>
      ) : null}
      {activeEditingId ? (
        <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-950">
          Düzenleme: alttaki forma kaydedin.
        </p>
      ) : null}

      {hiddenOlderCount > 0 ? (
        <p className="mb-1 text-[10px] text-slate-500">
          Son {RECENT_ORDER_LIMIT} kayıt (+{hiddenOlderCount} gizli)
        </p>
      ) : null}

      {isLoading ? <p className="text-xs text-slate-500">Yükleniyor…</p> : null}
      {isError ? <p className="text-xs text-red-600">Liste açılamadı.</p> : null}
      {!isLoading && !isError && orders.length === 0 ? (
        <p className="text-xs text-slate-500">Henüz sipariş yok.</p>
      ) : null}

      <ul className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto pr-0.5">
        {recentOrders.map((order) => {
          const canEdit = order.status === "PENDING";
          const isEditing = activeEditingId === order.id;
          const expanded = expandedId === order.id;
          const total = orderTotalPeople(order.items);
          return (
            <li
              key={order.id}
              className={cn(
                "overflow-hidden rounded-lg border text-xs",
                isEditing ? "border-sky-300 bg-sky-50/50" : "border-slate-100 bg-slate-50/40",
              )}
            >
              <button
                type="button"
                onClick={() => toggleExpand(order.id)}
                className="flex w-full items-center gap-1.5 px-2 py-2 text-left hover:bg-white/70"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <span className="font-semibold text-slate-900">{formatOrderDate(order.orderDate)}</span>
                  <span className="text-slate-600"> · {total}</span>
                  {order.kind === OrderKind.SUPPLEMENT ? (
                    <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-900">
                      ek
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "ml-1 inline-block max-w-[7rem] truncate rounded px-1 py-0.5 text-[9px] font-semibold align-middle",
                      order.status === "PENDING" ? "bg-amber-100 text-amber-900" : "bg-slate-200/80 text-slate-700",
                    )}
                    title={STATUS_UI[order.status]}
                  >
                    {STATUS_UI[order.status]}
                  </span>
                </div>
              </button>
              {expanded ? (
                <div className="border-t border-slate-100 px-2 pb-2 pt-0.5 text-[11px] text-slate-600">
                  <div className="mt-1 space-y-0.5">
                    {(["MORNING", "EVENING", "NIGHT"] as const).map((shift) => {
                      const lines = order.items
                        .filter((i) => i.shift === shift)
                        .filter((i) => i.quantity > 0)
                        .map((i) => `${CATEGORY_LABELS[i.category]}: ${i.quantity}`);
                      if (lines.length === 0) return null;
                      return (
                        <p key={shift}>
                          <span className="font-medium text-slate-800">{SHIFT_LABELS[shift]}:</span>{" "}
                          {lines.join(" · ")}
                        </p>
                      );
                    })}
                  </div>
                  {order.notes ? <p className="mt-1 text-[10px] text-slate-500">Not: {order.notes}</p> : null}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) onEdit(order);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Pencil className="h-3 w-3" /> Düzelt
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
