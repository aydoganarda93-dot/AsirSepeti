"use client";

import { ItemStatus } from "@prisma/client";
import { useCallback, useMemo, useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { KitchenCard } from "@/components/kitchen-card";

type KitchenItem = {
  id: string;
  companyName: string;
  category: keyof typeof CATEGORY_LABELS;
  quantity: number;
  status: ItemStatus;
  notes?: string | null;
};

export default function KitchenPage() {
  const [connected, setConnected] = useState(false);
  const [items] = useState<KitchenItem[]>([]);

  useMemo(() => {
    const source = new EventSource("/api/sse");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  const grouped = useMemo(
    () =>
      ALL_CATEGORIES.reduce<Record<string, KitchenItem[]>>((acc, category) => {
        acc[category] = items.filter((item) => item.category === category);
        return acc;
      }, {}),
    [items],
  );

  const handleAdvance = useCallback((id: string) => {
    void fetch(`/api/orders/${id}/status`, { method: "PATCH" });
  }, []);

  return (
    <main className="min-h-screen bg-black p-3 text-white">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mutfak Monitörü</h1>
        <span className={connected ? "text-green-400" : "text-red-400"}>{connected ? "Canlı" : "Bağlantı Yok"}</span>
      </header>
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ALL_CATEGORIES.map((category) => (
          <div key={category} className="space-y-2">
            <h2 className="text-lg font-semibold">{CATEGORY_LABELS[category]}</h2>
            {(grouped[category] ?? []).map((item) => (
              <KitchenCard key={item.id} {...item} onAdvance={() => handleAdvance(item.id)} />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
