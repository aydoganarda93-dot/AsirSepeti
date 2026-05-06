"use client";

import { ItemStatus } from "@prisma/client";
import { CATEGORY_LABELS } from "@/lib/categories";

type KitchenCardProps = {
  companyName: string;
  category: keyof typeof CATEGORY_LABELS;
  quantity: number;
  notes?: string | null;
  status: ItemStatus;
  onAdvance: () => void;
};

const statusClass: Record<ItemStatus, string> = {
  PENDING: "bg-gray-200 text-gray-900",
  PREPARING: "bg-yellow-300 text-yellow-950",
  READY: "bg-green-500 text-white",
};

export function KitchenCard({
  companyName,
  category,
  quantity,
  notes,
  status,
  onAdvance,
}: KitchenCardProps) {
  return (
    <button
      type="button"
      onClick={onAdvance}
      className={`w-full rounded-lg p-4 text-left shadow-sm ${statusClass[status]}`}
    >
      <p className="text-2xl font-bold">{companyName}</p>
      <p className="text-5xl font-extrabold leading-none">{quantity}</p>
      <p className="text-sm font-semibold uppercase tracking-wide">{CATEGORY_LABELS[category]}</p>
      {notes ? (
        <p className="mt-2 rounded bg-red-600 p-2 text-sm font-medium text-white">{notes}</p>
      ) : null}
    </button>
  );
}
