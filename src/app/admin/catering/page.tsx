"use client";

import { ItemCategory, OrderKind, OrderStatus, Shift } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChefHat,
  ClipboardList,
  Search,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AdminOrdersTable } from "@/components/admin-orders-table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ALL_CATEGORIES, CATEGORY_LABELS, SHIFT_LABELS } from "@/lib/categories";
import { formatDateOnlyTr, formatInstantTr, formatUtcYmdFromOffset } from "@/lib/date";
import { AdminOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string };

const URGENT_WINDOW_MS = 2 * 60 * 60 * 1000;

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  READY: "Hazır",
  DELIVERED: "Teslim Edildi",
};

function sumPortions(orders: AdminOrder[]): number {
  return orders.reduce((acc, o) => acc + o.items.reduce((s, it) => s + it.quantity, 0), 0);
}

function getQty(order: AdminOrder, category: ItemCategory, shift: Shift) {
  return order.items.find((item) => item.category === category && item.shift === shift)?.quantity ?? 0;
}

export default function AdminCateringPage() {
  const [date, setDate] = useState(() => formatUtcYmdFromOffset(0));
  const [companyFilter, setCompanyFilter] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [detailOrder, setDetailOrder] = useState<AdminOrder | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["catering-orders", date],
    queryFn: async () => {
      const response = await fetch(`/api/orders?date=${date}`);
      if (!response.ok) throw new Error("Siparişler alınamadı.");
      return (await response.json()) as AdminOrder[];
    },
    refetchOnWindowFocus: false,
  });

  const companiesQuery = useQuery({
    queryKey: ["catering-companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("Firmalar alınamadı.");
      return (await response.json()) as Company[];
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/sse");
    const onUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ["catering-orders"] });
    };
    source.addEventListener("update", onUpdate);
    source.addEventListener("connected", onUpdate);
    return () => {
      source.removeEventListener("update", onUpdate);
      source.removeEventListener("connected", onUpdate);
      source.close();
    };
  }, [queryClient]);

  const activeOrders = useMemo(
    () =>
      [...(ordersQuery.data ?? [])]
        .filter((order) => order.status === "PENDING")
        .filter((order) =>
          order.company.name.toLocaleLowerCase("tr").includes(companyFilter.toLocaleLowerCase("tr")),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [ordersQuery.data, companyFilter],
  );

  const activeOrderIdSet = useMemo(() => new Set(activeOrders.map((o) => o.id)), [activeOrders]);

  const visibleSelectedIds = useMemo(
    () => selectedOrderIds.filter((id) => activeOrderIdSet.has(id)),
    [selectedOrderIds, activeOrderIdSet],
  );

  // "Acil" sayacının saatçi rolü. SSR'da 0; mount'ta Date.now()'a sıçrar; sonra 60 saniyede bir günceller.
  // Not: useSyncExternalStore burada uygunsuzdu — Date.now() her çağrıda farklı dönüp sonsuz re-render tetikliyordu.
  const [nowMs, setNowMs] = useState<number>(0);
  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const totalPortions = useMemo(() => sumPortions(activeOrders), [activeOrders]);

  const urgentCount = useMemo(
    () => activeOrders.filter((o) => nowMs - new Date(o.createdAt).getTime() < URGENT_WINDOW_MS).length,
    [activeOrders, nowMs],
  );

  const selectedCount = visibleSelectedIds.length;

  async function approveOrder(orderId: string) {
    const previous = ordersQuery.data ?? [];
    const optimistic = previous.filter((order) => {
      if (order.id !== orderId) return true;
      return false;
    });
    queryClient.setQueryData(["catering-orders", date], optimistic);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: "CONFIRMED" }),
      });
      if (!response.ok) throw new Error();
      toast.success("Sipariş onaylandı.", {
        action: {
          label: "Geri Al",
          onClick: () => {
            const previousStatus = previous.find((order) => order.id === orderId)?.status ?? "PENDING";
            void fetch(`/api/orders/${orderId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderStatus: previousStatus }),
            }).then(() => ordersQuery.refetch());
          },
        },
      });
      await ordersQuery.refetch();
    } catch {
      queryClient.setQueryData(["catering-orders", date], previous);
      toast.error("Sipariş durumu güncellenemedi.");
    }
  }

  async function rejectOrder(orderId: string) {
    const previous = ordersQuery.data ?? [];
    queryClient.setQueryData(
      ["catering-orders", date],
      previous.filter((order) => order.id !== orderId),
    );

    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Sipariş reddedildi.");
      await ordersQuery.refetch();
    } catch {
      queryClient.setQueryData(["catering-orders", date], previous);
      toast.error("Sipariş reddedilemedi.");
    }
  }

  async function runBulkStatus(nextAction: "approve" | "reject") {
    if (visibleSelectedIds.length === 0) {
      toast.warning("Önce en az bir sipariş seçin.");
      return;
    }

    const previous = ordersQuery.data ?? [];
    const selectedSet = new Set(visibleSelectedIds);
    const optimistic = previous.filter((order) => !selectedSet.has(order.id));
    queryClient.setQueryData(["catering-orders", date], optimistic);

    try {
      await Promise.all(
        visibleSelectedIds.map((orderId) =>
          nextAction === "approve"
            ? fetch(`/api/orders/${orderId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderStatus: "CONFIRMED" as OrderStatus }),
              }).then((response) => {
                if (!response.ok) throw new Error("bulk approve failed");
              })
            : fetch(`/api/orders/${orderId}`, {
                method: "DELETE",
              }).then((response) => {
                if (!response.ok) throw new Error("bulk reject failed");
              }),
        ),
      );
      setSelectedOrderIds([]);
      setBulkRejectOpen(false);
      toast.success(
        nextAction === "approve"
          ? `${selectedSet.size} sipariş toplu onaylandı.`
          : `${selectedSet.size} sipariş toplu reddedildi.`,
      );
      await ordersQuery.refetch();
    } catch {
      queryClient.setQueryData(["catering-orders", date], previous);
      toast.error("Toplu işlem başarısız oldu.");
    }
  }

  return (
    <main
      className={cn(
        "relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl space-y-8 p-4 md:p-10",
        selectedCount > 0 && "pb-28",
      )}
    >
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Sipariş Onay Ekranı</h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-500">
            Fabrikalardan gelen günlük talepleri burada onaylayın veya reddedin. Toplu işlemler için satırları işaretleyin;
            hızlı işlem için satır sonundaki ikonları kullanın.
          </p>
        </div>
        <Link
          href="/admin/manual-yemek"
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-semibold leading-tight text-slate-900 shadow-sm transition-colors hover:bg-slate-200 sm:text-sm",
          )}
        >
          Manuel Yemek Ekleme Modülüne Git
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 shadow-sm ring-1 ring-slate-900/5">
          <CardContent className="flex items-start gap-3 p-4 md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bekleyen onay</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{activeOrders.length}</p>
              <p className="mt-0.5 text-xs text-slate-500">Filtrelenmiş liste</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm ring-1 ring-slate-900/5">
          <CardContent className="flex items-start gap-3 p-4 md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <UtensilsCrossed className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bugünkü toplam porsiyon</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{totalPortions}</p>
              <p className="mt-0.5 text-xs text-slate-500">Bekleyen satırların toplamı</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm ring-1 ring-slate-900/5">
          <CardContent className="flex items-start gap-3 p-4 md:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
              <Zap className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Acil / son dakika</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{urgentCount}</p>
              <p className="mt-0.5 text-xs text-slate-500">Son 2 saat içinde oluşturulanlar</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-[200px]">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            Tarih
          </label>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 border-slate-200 bg-slate-50/50 text-sm"
          />
        </div>
        <div className="min-w-0 flex-[2] sm:min-w-[220px]">
          <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-600">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            İşletme ara
          </label>
          <Input
            placeholder="Firma adı ile süz…"
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            className="h-9 border-slate-200 bg-white text-sm"
          />
        </div>
        <div className="flex items-end gap-2 sm:ml-auto">
          <p className="hidden text-xs text-slate-400 sm:block">
            Teslim günü: <span className="font-medium text-slate-600">{formatDateOnlyTr(date)}</span>
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Onay kuyruğu</h2>
          {ordersQuery.isFetching ? (
            <span className="text-xs text-slate-400">Güncelleniyor…</span>
          ) : null}
        </div>

        <AdminOrdersTable
          orders={activeOrders}
          onApprove={approveOrder}
          onReject={rejectOrder}
          onViewDetail={setDetailOrder}
          selectedOrderIds={visibleSelectedIds}
          onToggleSelectAll={(checked) => {
            setSelectedOrderIds(checked ? activeOrders.map((order) => order.id) : []);
          }}
          onToggleSelectOne={(orderId, checked) => {
            setSelectedOrderIds((prev) => {
              if (checked) return Array.from(new Set([...prev, orderId]));
              return prev.filter((id) => id !== orderId);
            });
          }}
        />
      </section>

      {ordersQuery.isLoading || companiesQuery.isLoading ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Veriler yükleniyor…</p>
      ) : null}
      {ordersQuery.isError || companiesQuery.isError ? (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          Catering verileri alınırken hata oluştu.
        </p>
      ) : null}

      {selectedCount > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-40 w-[min(100%-1.5rem,36rem)] -translate-x-1/2">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="text-center text-sm text-slate-600 sm:text-left">
              <span className="font-semibold text-slate-900">{selectedCount}</span> sipariş seçildi
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <Button type="button" size="sm" className="min-w-[120px]" onClick={() => void runBulkStatus("approve")}>
                Toplu onayla
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-[120px] border-rose-200 text-rose-800 hover:bg-rose-50"
                onClick={() => setBulkRejectOpen(true)}
              >
                Toplu reddet…
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedOrderIds([])}>
                Seçimi temizle
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seçilen siparişleri reddet</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount} sipariş listeden kaldırılacak ve reddedilmiş sayılacak. Bu işlemi yalnızca emin olduğunuzda
              onaylayın.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" onClick={() => void runBulkStatus("reject")}>
              Evet, reddet
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={detailOrder !== null} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <SheetContent className="sm:max-w-md">
          {detailOrder ? (
            <>
              <SheetClose />
              <SheetHeader className="pr-12">
                <SheetTitle className="text-xl">{detailOrder.company.name}</SheetTitle>
                <SheetDescription className="space-y-1 text-left">
                  <span className="block">
                    Teslim:{" "}
                    <span className="font-medium text-slate-700">{formatDateOnlyTr(detailOrder.orderDate.slice(0, 10))}</span>
                  </span>
                  <span className="block">
                    Kayıt: <span className="font-medium text-slate-700">{formatInstantTr(detailOrder.createdAt)}</span>
                  </span>
                  <span className="mt-2 inline-flex items-center gap-2">
                    <Badge variant="warning" className="font-semibold">
                      {STATUS_LABELS[detailOrder.status]}
                    </Badge>
                    {detailOrder.kind === OrderKind.SUPPLEMENT ? (
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        Üzerine ek
                      </Badge>
                    ) : null}
                  </span>
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">İletişim</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{detailOrder.contactName}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Özel not</p>
                  <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-700">
                    {detailOrder.notes?.trim() ? detailOrder.notes : "Not eklenmemiş."}
                  </p>
                </div>

                <div>
                  <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ChefHat className="h-3.5 w-3.5" aria-hidden />
                    Porsiyon detayı
                  </p>
                  <div className="space-y-3">
                    {ALL_CATEGORIES.map((category) => (
                      <div key={category} className="rounded-lg border border-slate-100 bg-white p-3">
                        <p className="text-xs font-bold text-slate-800">{CATEGORY_LABELS[category]}</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                          {(["MORNING", "EVENING", "NIGHT"] as const).map((shift) => (
                            <li key={shift} className="flex justify-between gap-2 border-b border-slate-50 pb-1 last:border-0 last:pb-0">
                              <span>{SHIFT_LABELS[shift]}</span>
                              <span className="font-semibold tabular-nums text-slate-900">
                                {getQty(detailOrder, category, shift)} adet
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </SheetBody>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
