"use client";

import { ItemCategory, ItemStatus, OrderKind, OrderStatus, Shift } from "@prisma/client";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronDown, ChevronRight, Pencil, PlusCircle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_LABELS, SHIFT_LABELS } from "@/lib/categories";

export type MyOrderRow = {
  id: string;
  orderDate: string;
  status: OrderStatus;
  kind: OrderKind;
  createdAt: string;
  notes: string | null;
  items: Array<{
    shift: Shift;
    category: ItemCategory;
    quantity: number;
    status: ItemStatus;
  }>;
};

const STATUS_UI: Record<OrderStatus, string> = {
  PENDING: "İşletmede onayda",
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  READY: "Hazır",
  DELIVERED: "Teslim edildi",
};

/** Faz 2: ana ekranda kart kalabalığını azalt */
const RECENT_ORDER_LIMIT = 8;

function orderTotalPeople(items: MyOrderRow["items"]) {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function formatOrderDate(iso: string) {
  try {
    return format(parseISO(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`), "d MMM yyyy", { locale: tr });
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

export function CustomerOrdersPanel({
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
    <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold text-emerald-900">Siparişlerim</h2>
          <p className="text-sm text-emerald-800/90">
            Son kayıtlar tek satırda; satıra basınca detay açılır. Onaylanmış siparişe ek için «Üzerine ekle».
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onRefetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenile
          </button>
          <button
            type="button"
            onClick={() => onSupplement()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Üzerine ekle
          </button>
        </div>
      </div>

      {extraOrderMode ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Sadece <strong>eklemek istediğiniz</strong> adetleri yazın; bu kayıt ayrı satır olarak onay bekler.
        </p>
      ) : null}
      {activeEditingId ? (
        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Miktarları değiştirip alttaki <strong>«Kaydet»</strong> ile gönderin (yalnızca onay bekleyen satırlar).
        </p>
      ) : null}

      {hiddenOlderCount > 0 ? (
        <p className="mb-2 text-xs text-emerald-800/90">
          Son <strong>{RECENT_ORDER_LIMIT}</strong> sipariş gösteriliyor ({hiddenOlderCount} eski kayıt gizli).
        </p>
      ) : null}

      {isLoading ? <p className="text-sm text-emerald-800">Yükleniyor...</p> : null}
      {isError ? (
        <p className="text-sm text-red-700">Liste açılamadı. Yenile&apos;ye basın.</p>
      ) : null}

      {!isLoading && !isError && orders.length === 0 ? (
        <p className="text-sm text-emerald-800/80">Henüz kayıt yok; siparişi alttaki yeşil formdan gönderin.</p>
      ) : null}

      <ul className="space-y-2">
        {recentOrders.map((order) => {
          const canEdit = order.status === "PENDING";
          const isEditing = activeEditingId === order.id;
          const expanded = expandedId === order.id;
          const total = orderTotalPeople(order.items);
          return (
            <li
              key={order.id}
              className={`overflow-hidden rounded-xl border text-sm ${
                isEditing ? "border-sky-400 bg-sky-50/80" : "border-emerald-100 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(order.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-emerald-50/50"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-900">{formatOrderDate(order.orderDate)}</span>
                  <span className="text-slate-600"> · {total} kişi</span>
                  {order.kind === OrderKind.SUPPLEMENT ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                      Üzerine ek
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      Siparişim
                    </span>
                  )}
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      order.status === "PENDING"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {STATUS_UI[order.status]}
                  </span>
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-emerald-100 px-3 pb-3 pt-1">
                  <p className="text-xs text-slate-500">
                    Gönderildi: {format(parseISO(order.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-slate-700">
                    {(["MORNING", "EVENING", "NIGHT"] as const).map((shift) => {
                      const lines = order.items
                        .filter((i) => i.shift === shift)
                        .filter((i) => i.quantity > 0)
                        .map((i) => `${CATEGORY_LABELS[i.category]}: ${i.quantity}`);
                      if (lines.length === 0) return null;
                      return (
                        <p key={shift}>
                          <span className="font-medium">{SHIFT_LABELS[shift]}:</span> {lines.join(" · ")}
                        </p>
                      );
                    })}
                  </div>
                  {order.notes ? <p className="mt-1 text-xs text-slate-600">Not: {order.notes}</p> : null}
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canEdit) {
                          onEdit(order);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Gönderdiğimi düzelt
                    </button>
                    {!canEdit ? (
                      <span className="ml-2 text-xs text-slate-500">İşleme alındı; ek için «Üzerine ekle».</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
