"use client";

import { ItemCategory, OrderStatus } from "@prisma/client";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { AdminOrder } from "@/lib/types";

type Props = {
  orders: AdminOrder[];
  onDelete: (id: string) => void;
  onSave: (order: AdminOrder) => void;
  onStatus: (id: string, status: OrderStatus) => void;
};

function getQty(order: AdminOrder, category: ItemCategory) {
  return order.items.find((item) => item.category === category)?.quantity ?? 0;
}
function getPrintCategory(order: AdminOrder) {
  return ALL_CATEGORIES.find((category) => getQty(order, category) > 0) ?? "OGLEN_YEMEGI";
}

export function AdminOrdersTable({ orders, onDelete, onSave, onStatus }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Firma</th>
            {ALL_CATEGORIES.map((category) => (
              <th key={category} className="p-2 text-right">
                {CATEGORY_LABELS[category]}
              </th>
            ))}
            <th className="p-2 text-left">Not</th>
            <th className="p-2 text-left">Durum</th>
            <th className="p-2 text-right">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t align-top">
              <td className="p-2">
                <p className="font-semibold">{order.company.name}</p>
                <p className="text-xs text-slate-500">{order.contactName}</p>
              </td>
              {ALL_CATEGORIES.map((category) => (
                <td key={`${order.id}-${category}`} className="p-2 text-right">
                  <input
                    type="number"
                    min={0}
                    defaultValue={getQty(order, category)}
                    className="w-16 rounded border p-1 text-right"
                    onBlur={(event) => {
                      const qty = Number(event.currentTarget.value) || 0;
                      const next: AdminOrder = {
                        ...order,
                        items: order.items.map((item) =>
                          item.category === category ? { ...item, quantity: qty } : item,
                        ),
                      };
                      onSave(next);
                    }}
                  />
                </td>
              ))}
              <td className="p-2">
                <input
                  defaultValue={order.notes ?? ""}
                  className="w-full min-w-48 rounded border p-1"
                  onBlur={(event) => onSave({ ...order, notes: event.currentTarget.value })}
                />
              </td>
              <td className="p-2">
                <select
                  defaultValue={order.status}
                  className="rounded border p-1"
                  onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="PREPARING">PREPARING</option>
                  <option value="READY">READY</option>
                  <option value="DELIVERED">DELIVERED</option>
                </select>
              </td>
              <td className="space-x-2 p-2 text-right">
                <button
                  className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                  onClick={() => onDelete(order.id)}
                >
                  Sil
                </button>
                <a
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white"
                  href={`/etiket/${order.id}?category=${getPrintCategory(order)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Etiket Yazdır
                </a>
              </td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={11} className="p-4 text-center text-slate-500">
                Kriterlere uygun sipariş bulunamadı.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
