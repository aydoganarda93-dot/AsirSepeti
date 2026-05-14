"use client";

import { Calendar, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatInstantTr } from "@/lib/date";

type SettingsPayload = {
  id: number;
  monthlyMenuStoragePath: string | null;
  monthlyMenuFileName: string | null;
  monthlyMenuYearMonth: string | null;
  monthlyMenuUpdatedAt: string | null;
};

type GetPayload = {
  configured: boolean;
  settings: SettingsPayload | null;
  previewUrl?: string | null;
  expiresIn?: number;
};

export default function AdminMonthlyMenuPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [payload, setPayload] = useState<GetPayload | null>(null);
  const [yearMonth, setYearMonth] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/monthly-menu");
    if (!response.ok) {
      toast.error("Menü bilgisi alınamadı.");
      return;
    }
    const data = (await response.json()) as GetPayload;
    setPayload(data);
    if (data.settings?.monthlyMenuYearMonth) {
      setYearMonth(data.settings.monthlyMenuYearMonth);
    } else {
      const now = new Date();
      const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      setYearMonth((prev) => (prev ? prev : ym));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.message("Önce PDF seçin.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      toast.error("Ay formatı yyyy-MM olmalı.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("yearMonth", yearMonth);
      const response = await fetch("/api/admin/monthly-menu", { method: "POST", body });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Yükleme başarısız.");
        return;
      }
      toast.success("Menü güncellendi.");
      setFile(null);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Aylık menüyü kaldırmak istediğinize emin misiniz?")) return;
    setUploading(true);
    try {
      const response = await fetch("/api/admin/monthly-menu", { method: "DELETE" });
      if (!response.ok) {
        toast.error("Silinemedi.");
        return;
      }
      toast.success("Menü kaldırıldı.");
      await load();
    } finally {
      setUploading(false);
    }
  }

  const settings = payload?.settings;
  const hasFile = Boolean(settings?.monthlyMenuStoragePath);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Aylık menü</h1>
        <p className="mt-1 text-sm text-slate-600">
          Supabase Storage bucket: <code className="rounded bg-slate-100 px-1">monthly-menus</code> (private). Eski
          dosya yenisiyle değişince otomatik silinir.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" aria-hidden />
            PDF yükleme
          </CardTitle>
          <CardDescription>Yalnızca PDF; boyut sınırı 12 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Yükleniyor…
            </p>
          ) : (
            <>
              {payload?.configured === false ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Supabase ortam değişkenleri eksik. <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> ve URL
                  tanımlayın.
                </p>
              ) : null}

              {hasFile ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  <p>
                    <span className="font-semibold">Dosya:</span> {settings?.monthlyMenuFileName ?? "—"}
                  </p>
                  <p>
                    <span className="font-semibold">Ay:</span> {settings?.monthlyMenuYearMonth ?? "—"}
                  </p>
                  <p className="text-xs text-slate-600">
                    Son güncelleme:{" "}
                    {settings?.monthlyMenuUpdatedAt
                      ? formatInstantTr(settings.monthlyMenuUpdatedAt)
                      : "—"}
                  </p>
                  {payload?.previewUrl ? (
                    <a
                      href={payload.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-emerald-700 underline"
                    >
                      İmzalı önizleme bağlantısı ({payload.expiresIn ?? "?"} sn)
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Henüz yüklenmiş menü yok.</p>
              )}

              <form onSubmit={handleUpload} className="space-y-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700" htmlFor="ym">
                    <Calendar className="h-3.5 w-3.5" aria-hidden />
                    Menü ayı (yyyy-MM)
                  </label>
                  <Input
                    id="ym"
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    disabled={uploading}
                    className="max-w-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="pdf">
                    PDF dosyası
                  </label>
                  <Input
                    id="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={uploading}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={uploading || payload?.configured === false}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Yükleniyor…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Yükle / güncelle
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading || !hasFile}
                    onClick={() => void handleDelete()}
                    className="text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Menüyü sil
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
