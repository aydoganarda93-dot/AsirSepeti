"use client";

import { ItemCategory, OrderStatus } from "@prisma/client";
import {
  CalendarRange,
  ChefHat,
  CircleCheck,
  Download,
  Filter,
  Package,
  PanelRightOpen,
} from "lucide-react";
import { addDays, subDays, startOfMonth, startOfYear, format } from "date-fns";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CompanyCombobox } from "@/components/company-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, SHIFT_LABELS } from "@/lib/categories";
import { formatDateOnlyTr, formatInstantTr } from "@/lib/date";
import { AdminOrder } from "@/lib/types";

type Company = {
  id: string;
  name: string;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Beklemede",
  CONFIRMED: "Onaylandı",
  PREPARING: "Hazırlanıyor",
  READY: "Hazır",
  DELIVERED: "Teslim Edildi",
};

/** Pastel durum rozetleri — Badge üzerinde className ile */
function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "border border-sky-200/80 bg-sky-50 text-sky-800";
    case "PREPARING":
      return "border border-amber-200/80 bg-amber-50 text-amber-900";
    case "READY":
      return "border border-violet-200/80 bg-violet-50 text-violet-900";
    case "DELIVERED":
      return "border border-emerald-200/80 bg-emerald-50 text-emerald-900";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-700";
  }
}

function activityTitle(type: string): string {
  switch (type) {
    case "STATUS_CHANGED":
      return "Durum değişti";
    case "ITEMS_UPDATED":
      return "Kalemler güncellendi";
    case "ADMIN_UPDATE":
      return "Yönetici güncellemesi";
    case "CUSTOMER_UPDATE":
      return "Müşteri güncellemesi";
    case "ORDER_CREATED":
      return "Sipariş oluşturuldu";
    case "ADMIN_MANUAL_UPSERT":
      return "Manuel sipariş güncellendi";
    case "ORDER_DELETED":
      return "Sipariş silindi";
    default:
      return type;
  }
}

function activityDetail(type: string, meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  if (type === "STATUS_CHANGED" && typeof m.from === "string" && typeof m.to === "string") {
    return `${STATUS_LABELS[m.from as OrderStatus] ?? m.from} → ${STATUS_LABELS[m.to as OrderStatus] ?? m.to}`;
  }
  if (type === "ADMIN_UPDATE" && Array.isArray(m.fields)) {
    return (m.fields as string[]).join(", ");
  }
  if (type === "CUSTOMER_UPDATE" && m.notes === true) {
    return "Not güncellendi";
  }
  return "";
}

function formatItemsLine(order: AdminOrder): string {
  return order.items
    .filter((i) => i.quantity > 0)
    .map(
      (i) =>
        `${SHIFT_LABELS[i.shift]} ${CATEGORY_LABELS[i.category as ItemCategory]} ×${i.quantity}`,
    )
    .join(" · ");
}

function formatItemsBullets(order: AdminOrder): { id: string; label: string }[] {
  return order.items
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      id: i.id,
      label: `${SHIFT_LABELS[i.shift]} — ${CATEGORY_LABELS[i.category as ItemCategory]} × ${i.quantity}`,
    }));
}

function truncateNote(text: string | null, max = 56): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function AdminOrderHistoryPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 14), "yyyy-MM-dd"));
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState<"Günlük" | "Haftalık" | "Aylık" | "Yıllık">("Haftalık");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["history-orders", startDate, endDate, companyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        includeActivities: "true",
      });
      if (companyId) params.set("companyId", companyId);
      const response = await fetch(`/api/orders?${params.toString()}`);
      if (!response.ok) throw new Error("Sipariş geçmişi alınamadı.");
      return (await response.json()) as AdminOrder[];
    },
    refetchOnWindowFocus: false,
  });

  const companiesQuery = useQuery({
    queryKey: ["history-companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("İşletme listesi alınamadı.");
      return (await response.json()) as Company[];
    },
    refetchOnWindowFocus: false,
  });

  const historyOrders = useMemo(
    () => (ordersQuery.data ?? []).filter((order) => order.status !== "PENDING"),
    [ordersQuery.data],
  );

  const metrics = useMemo(() => {
    const totalOrders = historyOrders.length;
    const totalItems = historyOrders.reduce(
      (sum, order) => sum + order.items.reduce((innerSum, item) => innerSum + item.quantity, 0),
      0,
    );
    const deliveredOrders = historyOrders.filter((order) => order.status === "DELIVERED").length;
    const preparingOrders = historyOrders.filter((order) => order.status === "PREPARING").length;

    return { totalOrders, totalItems, deliveredOrders, preparingOrders };
  }, [historyOrders]);

  function applyPeriod(nextPeriod: "Günlük" | "Haftalık" | "Aylık" | "Yıllık") {
    const now = new Date();
    const nextEndDate = format(now, "yyyy-MM-dd");
    let nextStartDate = nextEndDate;

    if (nextPeriod === "Günlük") {
      nextStartDate = nextEndDate;
    } else if (nextPeriod === "Haftalık") {
      nextStartDate = format(subDays(now, 6), "yyyy-MM-dd");
    } else if (nextPeriod === "Aylık") {
      nextStartDate = format(startOfMonth(now), "yyyy-MM-dd");
    } else if (nextPeriod === "Yıllık") {
      nextStartDate = format(startOfYear(now), "yyyy-MM-dd");
    }

    setPeriod(nextPeriod);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
  }

  function openDetail(order: AdminOrder) {
    setSelectedOrder(order);
    setSheetOpen(true);
  }

  function exportCsv() {
    const headers = [
      "Teslim tarihi",
      "Oluşturulma",
      "İşletme",
      "İletişim",
      "Durum",
      "Kalemler",
      "Not",
    ];
    const lines = historyOrders.map((order) =>
      [
        formatDateOnlyTr(order.orderDate.slice(0, 10)),
        formatInstantTr(order.createdAt),
        order.company.name,
        order.contactName,
        STATUS_LABELS[order.status],
        formatItemsLine(order),
        order.notes ?? "-",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    );
    const csv = [headers.map((h) => `"${h}"`).join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `siparis-gecmisi-${startDate}-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-10">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Sipariş Geçmişi</h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-600">
            Onaylanmış ve işlem görmüş siparişleri filtreleyin; satıra veya detay aksiyonuna tıklayarak kalemler ve aktiviteyi yan panelde görün.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-slate-200 text-slate-700 shadow-sm"
          onClick={exportCsv}
        >
          <Download className="mr-2 h-4 w-4 opacity-70" aria-hidden />
          CSV İndir
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Toplam porsiyon</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{metrics.totalItems}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CircleCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tamamlanan sipariş</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{metrics.deliveredOrders}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <CalendarRange className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Toplam kayıt</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{metrics.totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <ChefHat className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hazırlanıyor</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{metrics.preparingOrders}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(["Günlük", "Haftalık", "Aylık", "Yıllık"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={period === option ? "default" : "outline"}
                size="sm"
                className={cn(
                  "rounded-full px-4",
                  period === option ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 text-slate-700",
                )}
                onClick={() => applyPeriod(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              Aralık: <span className="font-medium text-slate-700">{startDate}</span> —{" "}
              <span className="font-medium text-slate-700">{endDate}</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-200"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              <Filter className="mr-2 h-4 w-4 opacity-70" aria-hidden />
              Filtrele
            </Button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">Başlangıç</p>
                <Input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">Bitiş</p>
                <Input type="date" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                <CompanyCombobox
                  companies={companiesQuery.data ?? []}
                  value={companyId}
                  onChange={setCompanyId}
                  label="İşletme"
                />
                <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 px-2 text-xs text-slate-600" onClick={() => setCompanyId("")}>
                  Tüm işletmeler
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 md:px-6">
          <h2 className="text-sm font-semibold text-slate-800">Siparişler</h2>
          <p className="mt-0.5 text-xs text-slate-500">Bekleyen siparişler bu listede yer almaz.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {historyOrders.map((order) => (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col gap-4 px-4 py-5 transition hover:bg-slate-50/90 md:flex-row md:items-center md:justify-between md:px-6 md:py-6"
              onClick={() => openDetail(order)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetail(order);
                }
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <p className="text-base font-bold text-slate-900">{order.company.name}</p>
                  <Badge variant="secondary" className={cn("font-semibold", statusBadgeClass(order.status))}>
                    {STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>
                    Teslim: <span className="font-medium text-slate-800">{formatDateOnlyTr(order.orderDate.slice(0, 10))}</span>
                  </span>
                  <span className="hidden sm:inline text-slate-300">|</span>
                  <span>
                    Oluşturulma: <span className="font-medium text-slate-800">{formatInstantTr(order.createdAt)}</span>
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  <span className="text-slate-500">İletişim:</span> {order.contactName}
                </p>
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Not:</span> {truncateNote(order.notes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(order);
                  }}
                >
                  <PanelRightOpen className="mr-2 h-4 w-4" aria-hidden />
                  Detay
                </Button>
              </div>
            </div>
          ))}
          {!ordersQuery.isLoading && historyOrders.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">Seçili kriterlere göre geçmiş sipariş bulunamadı.</div>
          ) : null}
        </div>

        {ordersQuery.isLoading || companiesQuery.isLoading ? (
          <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">Yükleniyor…</p>
        ) : null}
        {ordersQuery.isError || companiesQuery.isError ? (
          <p className="border-t border-red-100 bg-red-50/50 px-6 py-4 text-sm text-red-700">Geçmiş verisi alınırken hata oluştu.</p>
        ) : null}
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedOrder(null);
        }}
      >
        <SheetContent>
          {selectedOrder ? (
            <>
              <SheetClose />
              <SheetHeader className="pr-12">
                <SheetTitle>{selectedOrder.company.name}</SheetTitle>
                <SheetDescription className="space-y-1">
                  <span className="block">
                    Teslim: <span className="font-medium text-slate-700">{formatDateOnlyTr(selectedOrder.orderDate.slice(0, 10))}</span>
                  </span>
                  <span className="block">
                    Oluşturulma: <span className="font-medium text-slate-700">{formatInstantTr(selectedOrder.createdAt)}</span>
                  </span>
                  <span className="mt-2 inline-flex">
                    <Badge variant="secondary" className={cn("font-semibold", statusBadgeClass(selectedOrder.status))}>
                      {STATUS_LABELS[selectedOrder.status]}
                    </Badge>
                  </span>
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-8">
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Kalemler</h3>
                  {formatItemsBullets(selectedOrder).length === 0 ? (
                    <p className="text-sm text-slate-500">Kalem yok.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {formatItemsBullets(selectedOrder).map((row) => (
                        <li key={row.id} className="flex gap-2 text-sm text-slate-800">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                          <span>{row.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">İletişim ve not</h3>
                  <p className="text-sm text-slate-800">
                    <span className="text-slate-500">Kişi:</span> {selectedOrder.contactName}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {selectedOrder.notes?.trim() ? selectedOrder.notes : "—"}
                  </p>
                </section>

                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Aktivite</h3>
                  {(selectedOrder.activities ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500">Henüz kayıtlı aktivite yok (eski siparişler).</p>
                  ) : (
                    <ul className="relative space-y-0 border-l border-slate-200 pl-5">
                      {(selectedOrder.activities ?? []).map((a) => (
                        <li key={a.id} className="relative pb-6 last:pb-0">
                          <span
                            className="absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-200"
                            aria-hidden
                          />
                          <p className="text-sm font-semibold text-slate-900">{activityTitle(a.type)}</p>
                          <p className="text-xs text-slate-500">{formatInstantTr(a.createdAt)}</p>
                          {activityDetail(a.type, a.meta) ? (
                            <p className="mt-1 text-sm text-slate-600">{activityDetail(a.type, a.meta)}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </SheetBody>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
