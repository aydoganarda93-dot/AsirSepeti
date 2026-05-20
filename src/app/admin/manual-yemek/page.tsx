"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminCreateOrder } from "@/components/admin-create-order";

type Company = {
  id: string;
  name: string;
};

export default function AdminManualYemekPage() {
  const queryClient = useQueryClient();
  const companiesQuery = useQuery({
    queryKey: ["manual-yemek-companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("Firmalar alınamadı.");
      return (await response.json()) as Company[];
    },
    refetchOnWindowFocus: false,
  });

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 pb-12 md:p-10">
      <header className="space-y-2 border-b border-slate-100 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Manuel yemek ekleme</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          İşletmelere telefon veya kağıt üzerinden gelen talepleri buradan hızlıca sisteme işleyin. Aşağıdaki alanlar mobilde parmakla
          rahat kullanılacak şekilde düzenlendi.
        </p>
      </header>

      <AdminCreateOrder
        companies={companiesQuery.data ?? []}
        onCreated={() => {
          toast.success("Manuel sipariş kaydedildi; sipariş geçmişinde görünür.");
          void queryClient.invalidateQueries({ queryKey: ["history-orders"] });
          void queryClient.invalidateQueries({ queryKey: ["catering-orders"] });
        }}
      />

      {companiesQuery.isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Firma listesi yükleniyor…</p>
      ) : null}
      {companiesQuery.isError ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          Manuel modül için firma verileri alınamadı.
        </p>
      ) : null}
    </main>
  );
}
