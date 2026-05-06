"use client";

import { ItemCategory, ItemStatus } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { KitchenCard } from "@/components/kitchen-card";

type KitchenItem = {
  id: string; // order id
  companyName: string;
  category: ItemCategory;
  quantity: number;
  status: ItemStatus;
  notes?: string | null;
};

export default function KitchenPage() {
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();
  const activeQuery = useQuery({
    queryKey: ["kitchen-active"],
    queryFn: async () => {
      const response = await fetch("/api/kitchen/active");
      const orders = (await response.json()) as Array<{
        id: string;
        notes: string | null;
        company: { name: string };
        items: Array<{ category: ItemCategory; quantity: number; status: ItemStatus }>;
      }>;
      return orders.flatMap((order) =>
        order.items.map((item) => ({
          id: order.id,
          companyName: order.company.name,
          category: item.category,
          quantity: item.quantity,
          status: item.status,
          notes: order.notes,
        })),
      ) as KitchenItem[];
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const source = new EventSource("/api/sse");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("update", () => {
      void queryClient.invalidateQueries({ queryKey: ["kitchen-active"] });
    });
    return () => source.close();
  }, [queryClient]);

  const grouped = useMemo(
    () =>
      ALL_CATEGORIES.reduce<Record<string, KitchenItem[]>>((acc, category) => {
        acc[category] = (activeQuery.data ?? []).filter((item) => item.category === category);
        return acc;
      }, {}),
    [activeQuery.data],
  );
  const displayGroups = useMemo(
    () => [
      { key: "OGLEN_YEMEGI", title: CATEGORY_LABELS.OGLEN_YEMEGI, cats: ["OGLEN_YEMEGI"] as ItemCategory[] },
      { key: "KAPALI_KAP", title: CATEGORY_LABELS.KAPALI_KAP, cats: ["KAPALI_KAP"] as ItemCategory[] },
      { key: "SEFERTASI", title: CATEGORY_LABELS.SEFERTASI, cats: ["SEFERTASI"] as ItemCategory[] },
      { key: "SALATA", title: CATEGORY_LABELS.SALATA, cats: ["SALATA"] as ItemCategory[] },
      { key: "KUMANYA", title: CATEGORY_LABELS.KUMANYA, cats: ["KUMANYA"] as ItemCategory[] },
      { key: "TATLI_EKMEK", title: "Tatlı + Ekmek Arası", cats: ["TATLI", "EKMEK_ARASI"] as ItemCategory[] },
    ],
    [],
  );

  const handleAdvance = useCallback(
    (orderId: string, category: ItemCategory, status: ItemStatus) => {
      const next = status === "PENDING" ? "PREPARING" : "READY";
      void fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCategory: category, itemStatus: next }),
      }).then(() => queryClient.invalidateQueries({ queryKey: ["kitchen-active"] }));
    },
    [queryClient],
  );

  return (
    <main className="min-h-screen bg-black p-3 text-white">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mutfak Monitörü</h1>
        <span className={connected ? "text-green-400" : "text-red-400"}>{connected ? "Canlı" : "Bağlantı Yok"}</span>
      </header>
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {displayGroups.map((group) => (
          <div key={group.key} className="space-y-2">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            {group.cats.flatMap((cat) => grouped[cat] ?? []).map((item) => (
              <KitchenCard key={`${item.id}-${item.category}`} {...item} onAdvance={() => handleAdvance(item.id, item.category, item.status)} />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
