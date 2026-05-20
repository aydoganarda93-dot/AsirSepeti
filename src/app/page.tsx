"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { FieldErrors, UseFormRegister, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CustomerOrderFooter } from "@/components/customer-order/customer-order-footer";
import { CustomerOrderHeader } from "@/components/customer-order/customer-order-header";
import { CustomerOrderHistorySlim } from "@/components/customer-order/customer-order-history-slim";
import {
  CustomerOrderQuantityGrid,
  type ShiftKey,
} from "@/components/customer-order/customer-order-quantity-grid";
import { CustomerOrderTabs, type CustomerOrderTab } from "@/components/customer-order/customer-order-tabs";
import { QuickOrderPreview } from "@/components/customer-order/quick-order-preview";
import { CustomerOrderSuccessSplash } from "@/components/customer-order-success-splash";
import type { MyOrderRow } from "@/components/customer-orders-panel";
import { QuickOrderInput } from "@/components/quick-order-input";
import { ItemCategory } from "@prisma/client";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import { formatUtcYmdFromOffset } from "@/lib/date";
import { emptyFormQuantities, type FormQuantities, orderItemsToFormQuantities } from "@/lib/order-form";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const categoryShape = {
  KUMANYA: z.number().int().min(0),
  OGLEN_YEMEGI: z.number().int().min(0),
  EKMEK_ARASI: z.number().int().min(0),
  DUZ_EKMEK: z.number().int().min(0),
};

const formSchema = z
  .object({
    orderDate: z.string().min(1, "Tarih zorunludur."),
    notes: z.string().max(2000).optional(),
    quantities: z.object({
      morning: z.object(categoryShape),
      evening: z.object(categoryShape),
      night: z.object(categoryShape),
    }),
  })
  .refine(
    (value) =>
      ALL_CATEGORIES.some(
        (category) =>
          (value.quantities.morning[category] ?? 0) > 0 ||
          (value.quantities.evening[category] ?? 0) > 0 ||
          (value.quantities.night[category] ?? 0) > 0,
      ),
    {
      message: "En az bir yerde adet yazın (sıfırdan büyük).",
      path: ["quantities"],
    },
  );

type FormValues = z.infer<typeof formSchema>;

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const errorValue = (payload as { error?: unknown }).error;
  if (typeof errorValue === "string") return errorValue;
  return fallback;
}

function toYmd(iso: string) {
  if (iso.length >= 10 && iso.includes("-")) return iso.slice(0, 10);
  return iso;
}

function formatShortDate(iso: string): string {
  try {
    const date = parseISO(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`);
    return format(date, "d MMM", { locale: tr });
  } catch {
    return iso;
  }
}

function summarizeOrderItems(items: ReadonlyArray<{ category: ItemCategory; quantity: number }>): string {
  const totals = new Map<ItemCategory, number>();
  for (const item of items) {
    if (item.quantity <= 0) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.quantity);
  }
  return ALL_CATEGORIES.filter((c) => (totals.get(c) ?? 0) > 0)
    .map((c) => `${totals.get(c)} ${CATEGORY_LABELS[c]}`)
    .join(" · ");
}

const emptyShift = () =>
  ({
    KUMANYA: 0,
    OGLEN_YEMEGI: 0,
    EKMEK_ARASI: 0,
    DUZ_EKMEK: 0,
  }) as const;

function subscribeClientMounted(onStoreChange: () => void) {
  void onStoreChange;
  return () => {};
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const isClient = useSyncExternalStore(subscribeClientMounted, getClientMountedSnapshot, getServerMountedSnapshot);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [extraOrderMode, setExtraOrderMode] = useState(false);
  const [qtyHighlight, setQtyHighlight] = useState(false);
  const [showSuccessSplash, setShowSuccessSplash] = useState(false);
  const [orderTab, setOrderTab] = useState<CustomerOrderTab>("detailed");
  const [quickPreviewText, setQuickPreviewText] = useState("");
  const [splashOrder, setSplashOrder] = useState<{ id: string; cancelToken: string } | null>(null);

  const minDate = formatUtcYmdFromOffset(0);
  const maxDate = formatUtcYmdFromOffset(365);

  const showCustomerPanel = session?.user?.role === "CUSTOMER" && Boolean(session.user.companyId);
  const showMenuCard =
    (session?.user?.role === "CUSTOMER" && Boolean(session.user.companyId)) ||
    session?.user?.role === "ADMIN";

  const myOrdersQuery = useQuery({
    queryKey: ["my-orders", session?.user?.id, minDate, maxDate],
    queryFn: async () => {
      const response = await fetch(`/api/orders/my?from=${minDate}&to=${maxDate}`);
      if (!response.ok) throw new Error("Liste alınamadı");
      return (await response.json()) as MyOrderRow[];
    },
    enabled: showCustomerPanel && isClient,
  });

  const lastOrderSummary = useMemo(() => {
    const orders = myOrdersQuery.data ?? [];
    if (orders.length === 0) return null;
    const sorted = [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const reference = sorted.find((o) => o.kind === "STANDARD") ?? sorted[0];
    const itemsLine = summarizeOrderItems(reference.items);
    if (!itemsLine) return null;
    return { dateLabel: formatShortDate(reference.orderDate), itemsLine };
  }, [myOrdersQuery.data]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderDate: minDate,
      notes: "",
      quantities: {
        morning: { ...emptyShift() },
        evening: { ...emptyShift() },
        night: { ...emptyShift() },
      },
    },
  });

  const orderDateYmd = form.watch("orderDate");

  const bumpQuantityHighlight = useCallback(() => {
    setQtyHighlight(true);
    window.setTimeout(() => setQtyHighlight(false), 700);
  }, []);

  const applyQuickQuantities = useCallback(
    (quantities: FormQuantities) => {
      form.setValue("quantities", quantities, { shouldValidate: true, shouldDirty: true });
    },
    [form],
  );

  const appendQuickNotes = useCallback(
    (raw: string) => {
      const cur = form.getValues("notes")?.trim() ?? "";
      const next = cur ? `${cur}\n\n${raw}` : raw;
      form.setValue("notes", next.slice(0, 2000), { shouldDirty: true });
    },
    [form],
  );

  const handleSuccessSplashDone = useCallback(() => {
    setShowSuccessSplash(false);
    const current = splashOrder;
    setSplashOrder(null);
    if (current) {
      const params = new URLSearchParams({ orderId: current.id, t: current.cancelToken });
      router.push(`/success?${params.toString()}`);
    }
  }, [router, splashOrder]);

  const resetFormFresh = useCallback(() => {
    setEditingOrderId(null);
    setExtraOrderMode(false);
    form.reset({
      orderDate: formatUtcYmdFromOffset(0),
      notes: "",
      quantities: {
        morning: { ...emptyShift() },
        evening: { ...emptyShift() },
        night: { ...emptyShift() },
      },
    });
  }, [form]);

  function loadOrderForEdit(order: MyOrderRow) {
    setExtraOrderMode(false);
    setEditingOrderId(order.id);
    form.reset({
      orderDate: toYmd(order.orderDate),
      notes: order.notes ?? "",
      quantities: orderItemsToFormQuantities(order.items),
    });
    toast.message("Form dolduruldu — düzenleyip kaydedin.");
  }

  function beginExtraOrder() {
    setEditingOrderId(null);
    setExtraOrderMode(true);
    form.reset({
      orderDate: form.getValues("orderDate") || formatUtcYmdFromOffset(0),
      notes: "",
      quantities: emptyFormQuantities(),
    });
    toast.message("Sadece ek adetleri yazın.");
  }

  async function repeatLastOrder() {
    try {
      const response = await fetch(`/api/orders/my?latest=1&from=${minDate}&to=${maxDate}`);
      if (!response.ok) {
        toast.error("Son sipariş alınamadı.");
        return;
      }
      const payload = (await response.json()) as { order: MyOrderRow | null };
      const order = payload.order;
      if (!order) {
        toast.error("Henüz tekrarlanacak sipariş yok.");
        return;
      }
      setEditingOrderId(null);
      setExtraOrderMode(false);
      form.reset({
        orderDate: minDate,
        notes: order.notes ?? "",
        quantities: orderItemsToFormQuantities(order.items),
      });
      bumpQuantityHighlight();
      const itemsLine = summarizeOrderItems(order.items);
      toast.success(
        itemsLine
          ? `${formatShortDate(order.orderDate)} siparişiniz forma yazıldı: ${itemsLine}. Tarih bugüne ayarlandı.`
          : `${formatShortDate(order.orderDate)} siparişiniz forma yazıldı; tarih bugüne ayarlandı.`,
      );
    } catch {
      toast.error("Bağlantı hatası.");
    }
  }

  function addToCell(shift: ShiftKey, category: ItemCategory, delta: number) {
    const path = `quantities.${shift}.${category}` as const;
    const cur = Number(form.getValues(path)) || 0;
    form.setValue(path, Math.max(0, cur + delta), { shouldValidate: true, shouldDirty: true });
  }

  const onSubmit = form.handleSubmit(async (values: FormValues) => {
    setSubmitError("");
    setSubmitting(true);

    if (editingOrderId) {
      const response = await fetch(`/api/orders/${editingOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: values.notes,
          quantities: values.quantities,
        }),
      });
      setSubmitting(false);
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        setSubmitError(extractErrorMessage(errPayload, "Güncelleme başarısız."));
        return;
      }
      toast.success("Kaydedildi.");
      resetFormFresh();
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      return;
    }

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(extraOrderMode ? { ...values, asSupplement: true } : values),
    });
    setSubmitting(false);

    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      setSubmitError(extractErrorMessage(errPayload, "Sipariş gönderilemedi."));
      return;
    }

    const data = (await response.json()) as { id: string; cancelToken: string };

    if (extraOrderMode) {
      toast.success("Üzerine ekleme gönderildi; onay bekliyor.");
      resetFormFresh();
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      return;
    }

    setSplashOrder({ id: data.id, cancelToken: data.cancelToken });
    resetFormFresh();
    void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    setShowSuccessSplash(true);
  });

  const submitLabel = submitting
    ? "Gönderiliyor…"
    : editingOrderId
      ? "Değişiklikleri kaydet"
      : extraOrderMode
        ? "Üzerine eklemeyi onayla ve gönder"
        : "Siparişi onayla ve gönder";

  if (!isClient) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white pb-12 pt-4 md:pt-8">
      {showSuccessSplash ? <CustomerOrderSuccessSplash onFinish={handleSuccessSplashDone} /> : null}

      <div className="mx-auto max-w-6xl px-3 md:px-6">
        <CustomerOrderHeader
          showMenu={showMenuCard}
          orderDateYmd={orderDateYmd}
          showRepeat={showCustomerPanel && lastOrderSummary !== null}
          lastOrderSummary={lastOrderSummary}
          showUser={Boolean(session?.user)}
          userName={session?.user?.name ?? undefined}
          onRepeatLast={repeatLastOrder}
        />

        <div
          className={cn(
            "gap-6",
            showCustomerPanel ? "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start" : "",
          )}
        >
          <div className="rounded-2xl border border-emerald-100/80 bg-white p-4 shadow-lg shadow-emerald-900/5 ring-1 ring-slate-100 md:p-7">
            <div className="mb-5">
              <h1 className="mb-1 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">Sipariş ver</h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Teslim gününü seçin; hızlı yazım veya detaylı ızgaradan adet girin. En az bir hücrede 1 veya üzeri
                olmalı.
              </p>
            </div>

            {(editingOrderId || extraOrderMode) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">
                  {editingOrderId
                    ? "Gönderdiğiniz siparişi düzenliyorsunuz."
                    : "Üzerine ekleme yapıyorsunuz (ayrı onay satırı)."}
                </span>
                <button
                  type="button"
                  onClick={() => resetFormFresh()}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  Vazgeç
                </button>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Teslim günü</p>
                <input
                  type="date"
                  min={minDate}
                  max={maxDate}
                  disabled={Boolean(editingOrderId)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base font-medium outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  {...form.register("orderDate")}
                />
              </div>
              {editingOrderId ? (
                <p className="text-xs text-slate-500">
                  Teslim tarihini burada değiştiremezsiniz. Farklı gün için «Vazgeç» ile sıfırlayın veya «Üzerine ekle»
                  kullanın.
                </p>
              ) : null}
              {form.formState.errors.orderDate ? (
                <p className="text-sm text-red-600">{form.formState.errors.orderDate.message}</p>
              ) : null}

              <CustomerOrderTabs
                tab={orderTab}
                onTabChange={setOrderTab}
                quickPanel={
                  <div className="space-y-3">
                    <QuickOrderInput
                      disabled={submitting}
                      onApplyQuantities={applyQuickQuantities}
                      onAppendNotes={appendQuickNotes}
                      onApplied={bumpQuantityHighlight}
                      onTextChange={setQuickPreviewText}
                    />
                    <QuickOrderPreview text={quickPreviewText} />
                  </div>
                }
                detailedPanel={
                  <CustomerOrderQuantityGrid
                    form={form as unknown as UseFormReturn<Record<string, unknown>>}
                    disabled={submitting}
                    qtyHighlight={qtyHighlight}
                    onAddToCell={addToCell}
                  />
                }
              />

              {form.formState.errors.quantities ? (
                <p className="text-sm text-red-600">{form.formState.errors.quantities.message as string}</p>
              ) : null}

              <CustomerOrderFooter
                register={form.register as unknown as UseFormRegister<Record<string, unknown>>}
                errors={form.formState.errors as FieldErrors<Record<string, unknown>>}
                submitError={submitError}
                submitting={submitting}
                submitLabel={submitLabel}
              />
            </form>
          </div>

          {showCustomerPanel ? (
            <aside className="mt-6 lg:mt-0">
              <CustomerOrderHistorySlim
                orders={myOrdersQuery.data ?? []}
                isLoading={myOrdersQuery.isLoading}
                isError={myOrdersQuery.isError}
                onRefetch={() => void myOrdersQuery.refetch()}
                onEdit={loadOrderForEdit}
                onSupplement={beginExtraOrder}
                activeEditingId={editingOrderId}
                extraOrderMode={extraOrderMode}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
