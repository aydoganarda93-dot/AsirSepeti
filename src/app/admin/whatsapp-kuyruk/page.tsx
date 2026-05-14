"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUtcYmdFromOffset } from "@/lib/date";

type InboundRow = {
  id: string;
  provider: string;
  externalId: string | null;
  fromPhoneNorm: string;
  rawBody: string;
  status: string;
  parseAppliedTokens: number;
  createdAt: string;
  company: { id: string; name: string } | null;
  order: { id: string; orderDate: string; cancelToken: string } | null;
};

const QUERY_KEY = ["admin-inbound-messages"] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "İncelemede",
  ORDER_CREATED: "Sipariş oluşturuldu",
  DISMISSED: "Reddedildi",
  NO_COMPANY: "İşletme yok",
  PARSE_EMPTY: "Parse boş",
};

export default function AdminWhatsappQueuePage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [promoteDates, setPromoteDates] = useState<Record<string, string>>({});

  const listQuery = useQuery({
    queryKey: [...QUERY_KEY, statusFilter],
    queryFn: async () => {
      const qs =
        statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/inbound-messages${qs}`);
      if (!response.ok) throw new Error("Liste alınamadı.");
      return (await response.json()) as InboundRow[];
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ id, orderDate }: { id: string; orderDate: string }) => {
      const response = await fetch(`/api/inbound-messages/${id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderDate }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Sipariş oluşturulamadı.");
      return data;
    },
    onSuccess: () => {
      toast.success("Sipariş oluşturuldu.");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/inbound-messages/${id}/dismiss`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Reddedilemedi.");
      return data;
    },
    onSuccess: () => {
      toast.success("Kayıt reddedildi.");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-10">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp / gelen mesaj kuyruğu</CardTitle>
          <CardDescription>
            Webhook: <span className="font-mono text-xs">POST /api/webhooks/whatsapp</span> — sıra numarası
            işletmedeki WhatsApp alıcı hattı ile eşleşmelidir.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Select
            className="w-[220px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tümü</option>
            <option value="PENDING_REVIEW">İncelemede</option>
            <option value="PARSE_EMPTY">Parse boş</option>
            <option value="NO_COMPANY">İşletme yok</option>
            <option value="ORDER_CREATED">Sipariş oluşturuldu</option>
            <option value="DISMISSED">Reddedildi</option>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-slate-100">
                <TableRow>
                  <TableHead className="border border-slate-200 px-2">Zaman</TableHead>
                  <TableHead className="border border-slate-200 px-2">Durum</TableHead>
                  <TableHead className="border border-slate-200 px-2">İşletme</TableHead>
                  <TableHead className="border border-slate-200 px-2">Gönderen</TableHead>
                  <TableHead className="border border-slate-200 px-2">Metin</TableHead>
                  <TableHead className="border border-slate-200 px-2">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data?.map((row) => {
                  const defaultDate =
                    promoteDates[row.id] ?? formatUtcYmdFromOffset(1);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[140px] border border-slate-200 px-2 text-xs">
                        {format(new Date(row.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}
                      </TableCell>
                      <TableCell className="border border-slate-200 px-2 text-xs">
                        {STATUS_LABEL[row.status] ?? row.status}
                      </TableCell>
                      <TableCell className="border border-slate-200 px-2">
                        {row.company?.name ?? "—"}
                      </TableCell>
                      <TableCell className="border border-slate-200 px-2 font-mono text-xs">
                        {row.fromPhoneNorm}
                      </TableCell>
                      <TableCell className="max-w-[280px] border border-slate-200 px-2">
                        <span className="line-clamp-3 whitespace-pre-wrap">{row.rawBody}</span>
                      </TableCell>
                      <TableCell className="border border-slate-200 px-2">
                        <div className="flex flex-col gap-2">
                          {row.status === "PENDING_REVIEW" ? (
                            <>
                              <Input
                                type="date"
                                className="h-8 text-xs"
                                value={defaultDate}
                                onChange={(e) =>
                                  setPromoteDates((prev) => ({
                                    ...prev,
                                    [row.id]: e.target.value,
                                  }))
                                }
                                min={formatUtcYmdFromOffset(0)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={promoteMutation.isPending}
                                onClick={() =>
                                  promoteMutation.mutate({
                                    id: row.id,
                                    orderDate: promoteDates[row.id] ?? defaultDate,
                                  })
                                }
                              >
                                Siparişe çevir
                              </Button>
                            </>
                          ) : null}
                          {row.status !== "ORDER_CREATED" &&
                          row.status !== "DISMISSED" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={dismissMutation.isPending}
                              onClick={() => dismissMutation.mutate(row.id)}
                            >
                              Reddet
                            </Button>
                          ) : null}
                          {row.status === "ORDER_CREATED" && row.order ? (
                            <span className="text-xs text-slate-600">
                              Sipariş:{" "}
                              {format(new Date(row.order.orderDate), "d MMM yyyy", { locale: tr })}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!listQuery.isLoading && listQuery.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">
                      Kayıt yok.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {listQuery.isLoading ? <p className="p-4 text-sm text-slate-500">Yükleniyor...</p> : null}
          {listQuery.isError ? (
            <p className="p-4 text-sm text-red-600">Liste yüklenemedi.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
