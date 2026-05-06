"use client";

import { ItemCategory } from "@prisma/client";
import { addDays, format } from "date-fns";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AdminCreateOrder } from "@/components/admin-create-order";
import { AdminOrdersTable } from "@/components/admin-orders-table";
import { AdminToolbar } from "@/components/admin-toolbar";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { AdminOrder } from "@/lib/types";

type SummaryResponse = { totals: Record<ItemCategory, number> };
type Company = { id: string; name: string };
export default function AdminPage() {
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [notesOnly, setNotesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "total">("name");

  const ordersQuery = useQuery({
    queryKey: ["orders", date, notesOnly, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (notesOnly) params.set("hasNotes", "true");
      if (categoryFilter) params.set("category", categoryFilter);
      const response = await fetch(`/api/orders?${params.toString()}`);
      return (await response.json()) as AdminOrder[];
    },
    refetchOnWindowFocus: false,
  });

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await (await fetch("/api/companies")).json()) as Company[],
    refetchOnWindowFocus: false,
  });

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
  const orders = useMemo(() => {
    const filtered = (ordersQuery.data ?? []).filter((order) =>
      order.company.name.toLowerCase().includes(companyFilter.toLowerCase()),
    );
    return filtered.sort((a, b) => {
      if (sortBy === "name") return a.company.name.localeCompare(b.company.name, "tr");
      const aTotal = a.items.reduce((sum, item) => sum + item.quantity, 0);
      const bTotal = b.items.reduce((sum, item) => sum + item.quantity, 0);
      return bTotal - aTotal;
    });
  }, [ordersQuery.data, companyFilter, sortBy]);
  const exportExcel = () => {
    const rows = orders.map((order) => {
      const result: Record<string, string | number> = {
        Firma: order.company.name,
        Tarih: date,
        "İletişim Kişisi": order.contactName,
        Notlar: order.notes ?? "",
      };
      ALL_CATEGORIES.forEach((category) => {
        result[CATEGORY_LABELS[category]] = order.items.find((i) => i.category === category)?.quantity ?? 0;
      });
      return result;
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Siparisler");
    XLSX.writeFile(book, `siparisler-${date}.xlsx`);
  };

  return (
    <main className="space-y-6 p-4 md:p-8">
      <AdminToolbar
        date={date}
        companyFilter={companyFilter}
        categoryFilter={categoryFilter}
        notesOnly={notesOnly}
        sortBy={sortBy}
        onDate={setDate}
        onCompany={setCompanyFilter}
        onCategory={setCategoryFilter}
        onNotesOnly={setNotesOnly}
        onSort={setSortBy}
        onExport={exportExcel}
      />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <article key={card.category} className="rounded border bg-white p-3">
            <h2 className="text-sm font-medium">{card.label}</h2>
            <p className="text-3xl font-bold">{card.value}</p>
          </article>
        ))}
      </section>
      <AdminCreateOrder companies={companiesQuery.data ?? []} onCreated={() => ordersQuery.refetch()} />
      <AdminOrdersTable
        orders={orders}
        onDelete={async (id) => {
          await fetch(`/api/orders/${id}`, { method: "DELETE" });
          await Promise.all([ordersQuery.refetch(), summary.refetch()]);
        }}
        onSave={async (order) => {
          const quantities = Object.fromEntries(order.items.map((item) => [item.category, item.quantity]));
          await fetch(`/api/orders/${order.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: order.notes, quantities }),
          });
          await Promise.all([ordersQuery.refetch(), summary.refetch()]);
        }}
        onStatus={async (id, status) => {
          await fetch(`/api/orders/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderStatus: status }),
          });
          await ordersQuery.refetch();
        }}
      />
    </main>
  );
}
