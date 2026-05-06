"use client";

import { ItemCategory } from "@prisma/client";
import { addDays, format } from "date-fns";
import { tr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";

type FormValues = {
  companyName: string;
  contactName: string;
  orderDate: string;
  notes: string;
  quantities: Record<ItemCategory, number>;
};

export default function Home() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const minDate = format(addDays(new Date(), 2), "yyyy-MM-dd", { locale: tr });
  const form = useForm<FormValues>({
    defaultValues: {
      companyName: "",
      contactName: "",
      orderDate: minDate,
      notes: "",
      quantities: {
        OGLEN_YEMEGI: 0,
        KAPALI_KAP: 0,
        SEFERTASI: 0,
        SALATA: 0,
        KUMANYA: 0,
        TATLI: 0,
        EKMEK_ARASI: 0,
      },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSubmitting(false);
    if (!response.ok) return;
    const data = (await response.json()) as { id: string };
    router.push(`/success?orderId=${data.id}`);
  });

  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-bold">Catering Sipariş Formu</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-4">
        <input className="w-full rounded border p-2" placeholder="Firma Adı" {...form.register("companyName")} />
        <input className="w-full rounded border p-2" placeholder="İletişim Kişisi" {...form.register("contactName")} />
        <input type="date" min={minDate} className="w-full rounded border p-2" {...form.register("orderDate")} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {ALL_CATEGORIES.map((category) => (
            <label key={category} className="rounded border p-2 text-sm">
              <span>{CATEGORY_LABELS[category]}</span>
              <input type="number" min={0} className="mt-1 w-full rounded border p-1" {...form.register(`quantities.${category}`, { valueAsNumber: true })} />
            </label>
          ))}
        </div>
        <textarea className="w-full rounded border p-2" rows={4} placeholder="Özel notlar" {...form.register("notes")} />
        <button type="submit" disabled={submitting} className="w-full rounded bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {submitting ? "Gönderiliyor..." : "Siparişi Gönder"}
        </button>
      </form>
    </main>
  );
}
