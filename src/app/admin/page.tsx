"use client";

import { ItemCategory } from "@prisma/client";
import { addDays, format } from "date-fns";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";

type SummaryResponse = { totals: Record<ItemCategory, number> };

export default function AdminPage() {
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const summary = useQuery({
    queryKey: ["summary", date],
    queryFn: async () => {
      const response = await fetch(`/api/orders/summary?date=${date}`);
      return (await response.json()) as SummaryResponse;
    },
    refetchOnWindowFocus: false,
  });

  const cards = useMemo(
    () =>
      ALL_CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        value: summary.data?.totals[category] ?? 0,
      })),
    [summary.data],
  );

  return (
    <main className="space-y-6 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Paneli</h1>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded border p-2" />
      </header>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <article key={card.category} className="rounded border bg-white p-3">
            <h2 className="text-sm font-medium">{card.label}</h2>
            <p className="text-3xl font-bold">{card.value}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
