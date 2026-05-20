"use client";

import { Download, Edit2, FileSpreadsheet, Plus, Save } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CompaniesDataGrid } from "@/components/admin/companies-data-grid";
import { applyGridDemoOverlay } from "@/components/admin/companies-grid-utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  emptyGridPayload,
  parseAdminNoteToGrid,
  serializeGridToAdminNote,
  type CompanyGridPayload,
} from "@/lib/company-admin-grid";
import type { CompanyOrderGridHints } from "@/lib/company-grid-order-hints";
import { formatUtcYmdFromOffset } from "@/lib/date";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Company = {
  id: string;
  name: string;
  adminNote: string | null;
  whatsappPhoneE164?: string | null;
};

type RowData = {
  id: string;
  sn: number;
  companyName: string;
  whatsappPhoneE164: string;
  cesit: string;
  oglen: string;
  oglenEkmek: string;
  oglenEkmekArasi: string;
  oglenKumanya: string;
  aksam: string;
  aksamEkmek: string;
  aksamEkmekArasi: string;
  aksamKumanya: string;
  gece: string;
  geceEkmek: string;
  geceKumanya: string;
  aciklama: string;
  isNew: boolean;
};

const NUMERIC_FIELDS = new Set<keyof RowData>([
  "oglen",
  "oglenEkmek",
  "oglenEkmekArasi",
  "oglenKumanya",
  "aksam",
  "aksamEkmek",
  "aksamEkmekArasi",
  "aksamKumanya",
  "gece",
  "geceEkmek",
  "geceKumanya",
]);

function normalizeNumericCell(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "0";
  const n = Math.min(parseInt(digits, 10) || 0, 999_999);
  return String(n);
}

function displayNumeric(value: string): string | null {
  const t = value.trim();
  if (!t || t === "0") return null;
  const n = parseInt(t.replace(/\D/g, ""), 10);
  if (!n || n <= 0) return null;
  return String(n);
}

function buildRows(companies: Company[]): RowData[] {
  return companies.map((company, index) => {
    const parsed = parseAdminNoteToGrid(company.adminNote);
    return {
      id: company.id,
      sn: index + 1,
      companyName: company.name,
      whatsappPhoneE164: company.whatsappPhoneE164 ?? "",
      ...parsed,
      isNew: false,
    };
  });
}

function buildRowsFromArchive(companies: Company[], byCompany: Map<string, CompanyGridPayload>): RowData[] {
  return companies.map((company, index) => {
    const archived = byCompany.get(company.id) ?? emptyGridPayload();
    const live = parseAdminNoteToGrid(company.adminNote);
    const parsed = { ...archived, cesit: live.cesit };
    return {
      id: company.id,
      sn: index + 1,
      companyName: company.name,
      whatsappPhoneE164: company.whatsappPhoneE164 ?? "",
      ...parsed,
      isNew: false,
    };
  });
}

const COMPANIES_ADMIN_QUERY_KEY = ["companies-admin-list"] as const;

type CellFocus = { rowId: string; field: keyof RowData };

function CesitDisplay({ value }: { value: string }) {
  const t = value.trim();
  if (!t) return <span className="text-slate-400">—</span>;
  const looksLikeKap = /^\d/i.test(t) && /kap/i.test(t);
  if (looksLikeKap) {
    return (
      <Badge variant="secondary" className="border border-sky-200/80 bg-sky-50 font-semibold text-sky-900">
        {t}
      </Badge>
    );
  }
  return <span className="text-sm text-slate-800">{t}</span>;
}

function InlineField({
  field: _field,
  value,
  numeric,
  placeholder,
  editing,
  readOnly,
  orderHint,
  suppressOrderHint,
  onStartEdit,
  onCommit,
  onDraftChange,
  onCancel,
  className,
  inputClassName,
  displayMode = "default",
}: {
  field?: keyof RowData;
  value: string;
  numeric?: boolean;
  placeholder?: string;
  editing: boolean;
  readOnly?: boolean;
  /** Sipariş satırlarından türetilen bilgi (salt okunur alt yazı) */
  orderHint?: string | null;
  suppressOrderHint?: boolean;
  onStartEdit: () => void;
  onCommit: (next: string) => void;
  onDraftChange: (next: string) => void;
  onCancel?: () => void;
  className?: string;
  inputClassName?: string;
  displayMode?: "default" | "cesit";
}) {
  void _field;

  if (editing && !readOnly) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <input
          autoFocus
          type="text"
          inputMode={numeric ? "numeric" : "text"}
          pattern={numeric ? "[0-9]*" : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (numeric) {
              onDraftChange(v.replace(/[^\d]/g, ""));
            } else {
              onDraftChange(v);
            }
          }}
          onBlur={() => onCommit(value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel?.();
            }
          }}
          className={cn(
            "h-9 w-full min-w-0 rounded-md border border-green-600 bg-white px-2 text-sm shadow-sm outline-none ring-2 ring-green-100",
            inputClassName,
          )}
        />
      </div>
    );
  }

  const show = numeric ? displayNumeric(value) : value.trim();
  const hintNum =
    orderHint && numeric
      ? (() => {
          const m = /^(\d+)/.exec(orderHint.replace(/\s*(kum|düz|arası)\s*$/i, "").trim());
          return m ? parseInt(m[1], 10) : 0;
        })()
      : 0;
  const shouldPromoteOrderHint = !suppressOrderHint && numeric && !show && hintNum > 0;

  const mainBlock =
    displayMode === "cesit" ? (
      <CesitDisplay value={value} />
    ) : shouldPromoteOrderHint ? (
      <span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-sm font-bold tabular-nums text-blue-800">
        {hintNum}
      </span>
    ) : numeric && !show ? (
      <span className="text-slate-300">—</span>
    ) : !numeric && !show ? (
      <span className="text-slate-300">—</span>
    ) : numeric && show ? (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-900/[0.06] px-2 py-0.5 text-sm font-bold tabular-nums text-slate-900">
        {show}
      </span>
    ) : (
      show
    );

  if (readOnly) {
    return (
      <div
        className={cn(
          "flex min-h-[44px] w-full min-w-0 flex-col justify-center gap-1 rounded-md border border-transparent px-2 py-1.5 text-left text-sm",
          numeric ? "font-semibold tabular-nums text-slate-950" : "text-slate-800",
          className,
        )}
      >
        <div className="min-w-0">{mainBlock}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className={cn(
        "flex min-h-[44px] w-full min-w-0 flex-col items-stretch gap-1 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-slate-200 hover:bg-white/90",
        numeric ? "font-semibold tabular-nums text-slate-950" : "text-slate-800",
        className,
      )}
    >
      <div className="min-w-0 text-left">{mainBlock}</div>
    </button>
  );
}

export default function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const gridDemo = searchParams.get("gridDemo") === "1";
  const [search, setSearch] = useState("");
  const [patchById, setPatchById] = useState<Record<string, Partial<RowData>>>({});
  const [creatingRow, setCreatingRow] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [newRowCounter, setNewRowCounter] = useState(1);
  const [cellFocus, setCellFocus] = useState<CellFocus | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [viewPeriodYmd, setViewPeriodYmd] = useState<string | null>(null);
  const rolloverOnce = useRef(false);

  const metaQuery = useQuery({
    queryKey: ["company-grid-meta"],
    queryFn: async () => {
      const response = await fetch("/api/admin/company-grid-meta");
      if (!response.ok) throw new Error("Tarih bilgisi alınamadı.");
      return (await response.json()) as { todayPeriodYmd: string };
    },
    staleTime: 60_000,
  });

  const todayYmd = metaQuery.data?.todayPeriodYmd ?? "";
  const effectiveViewYmd = viewPeriodYmd ?? todayYmd;
  const gridReadOnly = Boolean(todayYmd && effectiveViewYmd && effectiveViewYmd !== todayYmd);

  const archiveQuery = useQuery({
    queryKey: ["company-grid-archive", effectiveViewYmd],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/company-grid-archive?periodStartYmd=${encodeURIComponent(effectiveViewYmd)}`,
      );
      if (!response.ok) throw new Error("Arşiv verisi alınamadı.");
      return (await response.json()) as {
        archives: { companyId: string; payload: CompanyGridPayload }[];
      };
    },
    enabled: Boolean(effectiveViewYmd && todayYmd && effectiveViewYmd !== todayYmd),
  });

  const companiesQuery = useQuery({
    queryKey: COMPANIES_ADMIN_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/companies");
      if (!response.ok) throw new Error("İşletme listesi alınamadı.");
      return (await response.json()) as Company[];
    },
    refetchOnWindowFocus: false,
  });

  const orderHintsQuery = useQuery({
    queryKey: ["company-grid-order-hints", effectiveViewYmd],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/company-grid-order-hints?date=${encodeURIComponent(effectiveViewYmd)}`,
      );
      if (!response.ok) throw new Error("Sipariş özeti alınamadı.");
      return (await response.json()) as {
        date: string;
        companies: Array<CompanyOrderGridHints & { companyId: string }>;
      };
    },
    enabled: Boolean(effectiveViewYmd),
    staleTime: 30_000,
  });

  const orderHintsByCompany = useMemo(() => {
    const m = new Map<string, CompanyOrderGridHints>();
    for (const c of orderHintsQuery.data?.companies ?? []) {
      m.set(c.companyId, {
        oglenOrderLine: c.oglenOrderLine,
        oglenEkmekOrderLine: c.oglenEkmekOrderLine,
        oglenEkmekArasiOrderLine: c.oglenEkmekArasiOrderLine,
        oglenKumanyaOrderLine: c.oglenKumanyaOrderLine,
        aksamOrderLine: c.aksamOrderLine,
        aksamEkmekOrderLine: c.aksamEkmekOrderLine,
        aksamEkmekArasiOrderLine: c.aksamEkmekArasiOrderLine,
        aksamKumanyaOrderLine: c.aksamKumanyaOrderLine,
        geceOrderLine: c.geceOrderLine,
        geceEkmekOrderLine: c.geceEkmekOrderLine,
        geceKumanyaOrderLine: c.geceKumanyaOrderLine,
      });
    }
    return m;
  }, [orderHintsQuery.data]);

  const baseRows = useMemo(() => {
    if (companiesQuery.status !== "success" || !companiesQuery.data) return [];
    if (!effectiveViewYmd || !todayYmd) return [];
    if (effectiveViewYmd === todayYmd) {
      return buildRows(companiesQuery.data);
    }
    const map = new Map<string, CompanyGridPayload>();
    for (const a of archiveQuery.data?.archives ?? []) {
      map.set(a.companyId, a.payload);
    }
    return buildRowsFromArchive(companiesQuery.data, map);
  }, [companiesQuery.status, companiesQuery.data, effectiveViewYmd, todayYmd, archiveQuery.data]);

  useEffect(() => {
    queueMicrotask(() => {
      setPatchById({});
      setDirtyIds([]);
      setCellFocus(null);
    });
  }, [effectiveViewYmd, companiesQuery.dataUpdatedAt, archiveQuery.dataUpdatedAt]);

  useEffect(() => {
    if (metaQuery.status !== "success" || rolloverOnce.current) return;
    rolloverOnce.current = true;
    void (async () => {
      try {
        await fetch("/api/admin/company-grid-rollover", { method: "POST" });
        await queryClient.invalidateQueries({ queryKey: COMPANIES_ADMIN_QUERY_KEY });
      } catch {
        /* yoksay */
      }
    })();
  }, [metaQuery.status, queryClient]);

  const rows = useMemo(
    () => baseRows.map((r) => ({ ...r, ...patchById[r.id] })),
    [baseRows, patchById],
  );

  const rowsRef = useRef(rows);
  const dirtyIdsRef = useRef(dirtyIds);
  rowsRef.current = rows;
  dirtyIdsRef.current = dirtyIds;

  const visibleRows = useMemo(
    () => rows.filter((row) => row.companyName.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))),
    [rows, search],
  );

  const displayRows = useMemo(
    () => applyGridDemoOverlay(visibleRows, gridDemo),
    [visibleRows, gridDemo],
  );

  const editingRow = useMemo(
    () => rows.find((row) => row.id === editingRowId) ?? null,
    [rows, editingRowId],
  );

  const dirtyCount = dirtyIds.length;
  const hasDirty = dirtyCount > 0;

  const markDirty = useCallback((id: string) => {
    setDirtyIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const isCellDirty = useCallback(
    (rowId: string, field: keyof RowData) =>
      patchById[rowId] !== undefined && patchById[rowId]?.[field] !== undefined,
    [patchById],
  );

  const updateCell = useCallback(
    (id: string, key: keyof RowData, value: string) => {
      setPatchById((prev) => ({
        ...prev,
        [id]: { ...prev[id], [key]: value },
      }));
      markDirty(id);
    },
    [markDirty],
  );

  const beginEditCell = useCallback(
    (rowId: string, field: keyof RowData, current: string) => {
      if (gridReadOnly) return;
      setCellFocus({ rowId, field });
      if (NUMERIC_FIELDS.has(field)) {
        const numericCurrent = current.replace(/\D/g, "");
        setDraftValue(numericCurrent === "0" ? "" : numericCurrent);
        return;
      }
      setDraftValue(current);
    },
    [gridReadOnly],
  );

  const commitCell = useCallback(
    (rowId: string, field: keyof RowData, raw: string) => {
      const next = NUMERIC_FIELDS.has(field) ? normalizeNumericCell(raw) : raw;
      updateCell(rowId, field, next);
      setCellFocus(null);
      setDraftValue("");
    },
    [updateCell],
  );

  const cancelEditCell = useCallback(() => {
    setCellFocus(null);
    setDraftValue("");
  }, []);

  async function persistRow(row: RowData) {
    const response = await fetch(`/api/companies/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: row.companyName.trim(),
        adminNote: serializeGridToAdminNote({
          cesit: row.cesit,
          oglen: normalizeNumericCell(row.oglen),
          oglenEkmek: normalizeNumericCell(row.oglenEkmek),
          oglenEkmekArasi: normalizeNumericCell(row.oglenEkmekArasi),
          oglenKumanya: normalizeNumericCell(row.oglenKumanya),
          aksam: normalizeNumericCell(row.aksam),
          aksamEkmek: normalizeNumericCell(row.aksamEkmek),
          aksamEkmekArasi: normalizeNumericCell(row.aksamEkmekArasi),
          aksamKumanya: normalizeNumericCell(row.aksamKumanya),
          gece: normalizeNumericCell(row.gece),
          geceEkmek: normalizeNumericCell(row.geceEkmek),
          geceKumanya: normalizeNumericCell(row.geceKumanya),
          aciklama: row.aciklama,
        }),
        whatsappPhoneE164: row.whatsappPhoneE164.trim() ? row.whatsappPhoneE164.trim() : null,
      }),
    });
    if (!response.ok) throw new Error("Satır kaydedilemedi.");
  }

  async function handleSaveRow(rowId: string) {
    if (gridReadOnly) {
      toast.info("Geçmiş gün salt okunur; kayıt yapılamaz.");
      return;
    }

    if (cellFocus?.rowId === rowId) {
      const pending = cellFocus;
      const next = NUMERIC_FIELDS.has(pending.field)
        ? normalizeNumericCell(draftValue)
        : draftValue;
      flushSync(() => {
        setPatchById((prev) => ({
          ...prev,
          [pending.rowId]: { ...prev[pending.rowId], [pending.field]: next },
        }));
        setDirtyIds((prev) => (prev.includes(pending.rowId) ? prev : [...prev, pending.rowId]));
        setCellFocus(null);
        setDraftValue("");
      });
    }

    const row = rowsRef.current.find((r) => r.id === rowId);
    if (!row) return;
    if (!row.companyName.trim()) {
      toast.error("Firma adı boş bırakılamaz.");
      return;
    }

    setSavingRowId(rowId);
    try {
      await persistRow(row);
      setDirtyIds((prev) => prev.filter((id) => id !== rowId));
      setPatchById((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      toast.success("Satır kaydedildi.");
      await companiesQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydetme sırasında hata oluştu.");
      throw error;
    } finally {
      setSavingRowId(null);
    }
  }

  async function handleSaveAll() {
    if (gridReadOnly) {
      toast.info("Geçmiş gün salt okunur; kayıt yapılamaz.");
      return;
    }

    if (cellFocus) {
      const pending = cellFocus;
      const next = NUMERIC_FIELDS.has(pending.field)
        ? normalizeNumericCell(draftValue)
        : draftValue;
      flushSync(() => {
        setPatchById((prev) => ({
          ...prev,
          [pending.rowId]: { ...prev[pending.rowId], [pending.field]: next },
        }));
        setDirtyIds((prev) => (prev.includes(pending.rowId) ? prev : [...prev, pending.rowId]));
        setCellFocus(null);
        setDraftValue("");
      });
    }

    const currentDirtyIds = dirtyIdsRef.current;
    const currentRows = rowsRef.current;

    if (currentDirtyIds.length === 0) {
      toast.info("Kaydedilecek değişiklik bulunmuyor.");
      return;
    }

    setSavingAll(true);
    try {
      const dirtyRows = currentRows.filter((row) => currentDirtyIds.includes(row.id));
      for (const row of dirtyRows) {
        if (!row.companyName.trim()) {
          throw new Error("Firma adı boş bırakılamaz.");
        }

        await persistRow(row);
      }

      toast.success("Tüm değişiklikler kaydedildi.");
      await companiesQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kaydetme sırasında hata oluştu.");
    } finally {
      setSavingAll(false);
    }
  }

  function exportToExcel(exportVisibleOnly: boolean) {
    const source = exportVisibleOnly ? visibleRows : rows;
    if (source.length === 0) {
      toast.info(exportVisibleOnly ? "Aramaya uygun satır yok." : "Dışa aktarılacak işletme yok.");
      return;
    }
    const sheetRows = source.map((row, index) => ({
      "S/N": index + 1,
      Firma: row.companyName,
      "WhatsApp (E.164)": row.whatsappPhoneE164 || "",
      Çeşit: row.cesit,
      "Öğle adet": row.oglen,
      "Öğle ekmek": row.oglenEkmek,
      "Öğle ekmek arası": row.oglenEkmekArasi,
      "Öğle kumanya": row.oglenKumanya,
      "Akşam adet": row.aksam,
      "Akşam ekmek": row.aksamEkmek,
      "Akşam ekmek arası": row.aksamEkmekArasi,
      "Akşam kumanya": row.aksamKumanya,
      "Gece adet": row.gece,
      "Gece ekmek": row.geceEkmek,
      "Gece kumanya": row.geceKumanya,
      Açıklama: row.aciklama,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "İşletmeler");
    const suffix = effectiveViewYmd || formatUtcYmdFromOffset(0);
    XLSX.writeFile(workbook, `isletmeler-${suffix}.xlsx`);
    toast.success("Excel dosyası indirildi.");
  }

  async function deleteCompanyRow(id: string) {
    try {
      const target = rows.find((row) => row.id === id);
      if (target?.isNew) {
        queryClient.setQueryData<Company[]>(COMPANIES_ADMIN_QUERY_KEY, (old) => old?.filter((row) => row.id !== id) ?? []);
        setDirtyIds((prev) => prev.filter((item) => item !== id));
        setDeleteTargetId(null);
        toast.success("Yeni satır kaldırıldı.");
        return;
      }

      const response = await fetch(`/api/companies/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "İşletme silinemedi.");
      }
      toast.success("İşletme silindi.");
      setDeleteTargetId(null);
      setEditingRowId(null);
      await companiesQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşletme silme başarısız.");
    }
  }

  const isEditing = (rowId: string, field: keyof RowData) =>
    cellFocus?.rowId === rowId && cellFocus?.field === field;

  const getDraftOrRow = (row: RowData, field: keyof RowData) =>
    isEditing(row.id, field) ? draftValue : String(row[field] ?? "");

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 bg-slate-50/50 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">İşletmeler</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Fabrika yemek takip formu. Satır sonundaki kalem ile düzenleme moduna geçin; hücreye çift tıklayarak da açabilirsiniz. Sıfır değerler gizlenir; sipariş özeti ilgili hücrede gösterilir. Servis başlıklarındaki ok ile alt sütunları genişletin.
          {gridDemo ? (
            <span className="mt-1 block text-amber-700">Demo verisi aktif (?gridDemo=1).</span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <label htmlFor="grid-period-date" className="text-xs font-semibold tracking-wide text-slate-500">
            Gün Seçin
          </label>
          <Input
            id="grid-period-date"
            type="date"
            className="h-10 w-full max-w-[200px] border-slate-200 bg-white text-sm focus-visible:ring-2 focus-visible:ring-slate-400/50 sm:w-auto"
            value={effectiveViewYmd}
            max={todayYmd || undefined}
            disabled={!todayYmd || metaQuery.isLoading}
            onChange={(e) => {
              const v = e.target.value;
              setViewPeriodYmd(v || null);
            }}
          />
          {metaQuery.isError ? (
            <p className="text-xs text-red-600">Tarih bilgisi yüklenemedi.</p>
          ) : null}
        </div>
        {gridReadOnly ? (
          <p className="max-w-xl text-sm text-slate-700">
            Geçmiş bir günü görüntülüyorsunuz; hücreler salt okunur. Excel ile bu günün arşivlenmiş verisini indirebilirsiniz. Sipariş özeti, teslim tarihi bu günle eşleşen siparişlerden hesaplanır.
          </p>
        ) : (
          <p className="max-w-xl text-sm text-slate-600">
            Seçili güne ait onaylı sipariş adetleri, ilgili hücrede «sipariş» etiketiyle gösterilir (teslim tarihi bu günle aynı kayıtlar).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 border-slate-200 bg-slate-50/80 pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-slate-400/40"
              placeholder="İşletme ara…"
              aria-label="İşletme filtrele"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-10 shrink-0 border-slate-200 p-0 text-slate-700 hover:bg-slate-900 hover:text-white"
            title="Yeni satır"
            disabled={creatingRow || gridReadOnly}
            onClick={async () => {
              try {
                setCreatingRow(true);
                const ordinal = newRowCounter;
                setNewRowCounter(ordinal + 1);
                const tempName = `Yeni İşletme ${ordinal}-${Date.now()}`;
                const response = await fetch("/api/companies", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: tempName }),
                });
                if (!response.ok) throw new Error();
                const created = (await response.json()) as Company;
                queryClient.setQueryData<Company[]>(COMPANIES_ADMIN_QUERY_KEY, (old) => {
                  const next = old ? [...old, created] : [created];
                  return [...next].sort((a, b) => a.name.localeCompare(b.name, "tr"));
                });
                toast.success("Yeni işletme satırı eklendi.");
              } catch {
                toast.error("Yeni işletme satırı oluşturulamadı.");
              } finally {
                setCreatingRow(false);
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            disabled={savingAll || !hasDirty || gridReadOnly}
            onClick={() => void handleSaveAll()}
            className={cn(
              "h-9 gap-1.5 bg-slate-900 px-4 hover:bg-slate-800",
              hasDirty && "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-white",
            )}
          >
            <Save className="h-4 w-4" />
            {savingAll ? "Kaydediliyor…" : `Kaydet (${dirtyCount})`}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2.5 text-xs text-slate-700"
              onClick={() => exportToExcel(false)}
              disabled={rows.length === 0}
              title="Tümünü Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Tümü
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2.5 text-xs text-slate-700"
              onClick={() => exportToExcel(true)}
              disabled={visibleRows.length === 0}
              title="Filtrelenmiş Excel"
            >
              <Download className="h-3.5 w-3.5" />
              Filtre
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: modern grid */}
      <div className="hidden md:block">
        {!companiesQuery.isLoading ? (
          <CompaniesDataGrid
            rows={displayRows}
            gridReadOnly={gridReadOnly}
            orderHintsByCompany={orderHintsByCompany}
            getDraftOrRow={(row, field) => getDraftOrRow(row as RowData, field)}
            isCellDirty={isCellDirty}
            isEditing={isEditing}
            beginEditCell={beginEditCell}
            commitCell={commitCell}
            cancelEditCell={cancelEditCell}
            setDraftValue={setDraftValue}
            onOpenCompanyDialog={setEditingRowId}
            onSaveRow={handleSaveRow}
            savingRowId={savingRowId}
          />
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Yükleniyor…</p>
        )}
      </div>

      {/* Mobile: card stack */}
      <div className="flex flex-col gap-4 md:hidden">
        {displayRows.map((row) => {
          const oh = orderHintsByCompany.get(row.id);
          return (
          <div
            key={row.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                className="text-left text-base font-bold text-slate-900"
                onClick={() => {
                  if (!gridReadOnly) setEditingRowId(row.id);
                }}
              >
                {row.companyName || "Yeni İşletme"}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2"
                disabled={gridReadOnly}
                onClick={() => {
                  if (!gridReadOnly) setEditingRowId(row.id);
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <p className="mb-1 text-xs font-medium text-slate-500">Çeşit</p>
                <InlineField
                  field="cesit"
                  value={getDraftOrRow(row, "cesit")}
                  readOnly={gridReadOnly} editing={isEditing(row.id, "cesit")}
                  displayMode="cesit"
                  onStartEdit={() => beginEditCell(row.id, "cesit", row.cesit)}
                  onDraftChange={setDraftValue}
                  onCommit={(v) => commitCell(row.id, "cesit", v)}
                  onCancel={cancelEditCell}
                />
              </div>
              <p className="col-span-2 mt-1 border-t border-slate-100 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Öğle servisi
              </p>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Adet</p>
                <InlineField field="oglen" value={getDraftOrRow(row, "oglen")} numeric placeholder="0" orderHint={oh?.oglenOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "oglen")} readOnly={gridReadOnly} editing={isEditing(row.id, "oglen")} onStartEdit={() => beginEditCell(row.id, "oglen", row.oglen)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "oglen", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Ekmek</p>
                <InlineField field="oglenEkmek" value={getDraftOrRow(row, "oglenEkmek")} numeric placeholder="0" orderHint={oh?.oglenEkmekOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "oglenEkmek")} readOnly={gridReadOnly} editing={isEditing(row.id, "oglenEkmek")} onStartEdit={() => beginEditCell(row.id, "oglenEkmek", row.oglenEkmek)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "oglenEkmek", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Ekmek arası</p>
                <InlineField field="oglenEkmekArasi" value={getDraftOrRow(row, "oglenEkmekArasi")} numeric placeholder="0" orderHint={oh?.oglenEkmekArasiOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "oglenEkmekArasi")} readOnly={gridReadOnly} editing={isEditing(row.id, "oglenEkmekArasi")} onStartEdit={() => beginEditCell(row.id, "oglenEkmekArasi", row.oglenEkmekArasi)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "oglenEkmekArasi", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Kumanya</p>
                <InlineField field="oglenKumanya" value={getDraftOrRow(row, "oglenKumanya")} numeric placeholder="0" orderHint={oh?.oglenKumanyaOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "oglenKumanya")} readOnly={gridReadOnly} editing={isEditing(row.id, "oglenKumanya")} onStartEdit={() => beginEditCell(row.id, "oglenKumanya", row.oglenKumanya)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "oglenKumanya", v)} onCancel={cancelEditCell} />
              </div>
              <p className="col-span-2 mt-1 border-t border-slate-100 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Akşam servisi
              </p>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Adet</p>
                <InlineField field="aksam" value={getDraftOrRow(row, "aksam")} numeric placeholder="0" orderHint={oh?.aksamOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "aksam")} readOnly={gridReadOnly} editing={isEditing(row.id, "aksam")} onStartEdit={() => beginEditCell(row.id, "aksam", row.aksam)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "aksam", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Ekmek</p>
                <InlineField field="aksamEkmek" value={getDraftOrRow(row, "aksamEkmek")} numeric placeholder="0" orderHint={oh?.aksamEkmekOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "aksamEkmek")} readOnly={gridReadOnly} editing={isEditing(row.id, "aksamEkmek")} onStartEdit={() => beginEditCell(row.id, "aksamEkmek", row.aksamEkmek)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "aksamEkmek", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Ekmek arası</p>
                <InlineField field="aksamEkmekArasi" value={getDraftOrRow(row, "aksamEkmekArasi")} numeric placeholder="0" orderHint={oh?.aksamEkmekArasiOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "aksamEkmekArasi")} readOnly={gridReadOnly} editing={isEditing(row.id, "aksamEkmekArasi")} onStartEdit={() => beginEditCell(row.id, "aksamEkmekArasi", row.aksamEkmekArasi)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "aksamEkmekArasi", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Kumanya</p>
                <InlineField field="aksamKumanya" value={getDraftOrRow(row, "aksamKumanya")} numeric placeholder="0" orderHint={oh?.aksamKumanyaOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "aksamKumanya")} readOnly={gridReadOnly} editing={isEditing(row.id, "aksamKumanya")} onStartEdit={() => beginEditCell(row.id, "aksamKumanya", row.aksamKumanya)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "aksamKumanya", v)} onCancel={cancelEditCell} />
              </div>
              <p className="col-span-2 mt-1 border-t border-slate-100 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gece servisi
              </p>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Adet</p>
                <InlineField field="gece" value={getDraftOrRow(row, "gece")} numeric placeholder="0" orderHint={oh?.geceOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "gece")} readOnly={gridReadOnly} editing={isEditing(row.id, "gece")} onStartEdit={() => beginEditCell(row.id, "gece", row.gece)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "gece", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Ekmek</p>
                <InlineField field="geceEkmek" value={getDraftOrRow(row, "geceEkmek")} numeric placeholder="0" orderHint={oh?.geceEkmekOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "geceEkmek")} readOnly={gridReadOnly} editing={isEditing(row.id, "geceEkmek")} onStartEdit={() => beginEditCell(row.id, "geceEkmek", row.geceEkmek)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "geceEkmek", v)} onCancel={cancelEditCell} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Kumanya</p>
                <InlineField field="geceKumanya" value={getDraftOrRow(row, "geceKumanya")} numeric placeholder="0" orderHint={oh?.geceKumanyaOrderLine ?? null}
                          suppressOrderHint={isCellDirty(row.id, "geceKumanya")} readOnly={gridReadOnly} editing={isEditing(row.id, "geceKumanya")} onStartEdit={() => beginEditCell(row.id, "geceKumanya", row.geceKumanya)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "geceKumanya", v)} onCancel={cancelEditCell} />
              </div>
              <div className="col-span-2">
                <p className="mb-1 text-xs font-medium text-slate-500">Açıklama</p>
                <InlineField field="aciklama" value={getDraftOrRow(row, "aciklama")} readOnly={gridReadOnly} editing={isEditing(row.id, "aciklama")} onStartEdit={() => beginEditCell(row.id, "aciklama", row.aciklama)} onDraftChange={setDraftValue} onCommit={(v) => commitCell(row.id, "aciklama", v)} onCancel={cancelEditCell} />
              </div>
            </div>
          </div>
          );
        })}
        {!companiesQuery.isLoading && visibleRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Aramaya uygun işletme yok.</p>
        ) : null}
      </div>

      {companiesQuery.isLoading ? <p className="text-sm text-slate-500">Yükleniyor…</p> : null}
      {companiesQuery.isError ? <p className="text-sm text-red-600">İşletmeler alınırken bir hata oluştu.</p> : null}

      <Dialog open={!!editingRow} onOpenChange={(next) => !next && setEditingRowId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İşletmeyi Düzenle</DialogTitle>
            <DialogDescription>İşletme adını güncelleyin veya silme işlemini buradan yönetin.</DialogDescription>
          </DialogHeader>
          {editingRow ? (
            <div className="space-y-3 pt-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">İşletme Adı</p>
                <Input
                  value={editingRow.companyName}
                  onChange={(event) => updateCell(editingRow.id, "companyName", event.target.value)}
                  placeholder="İşletme adı"
                  disabled={gridReadOnly}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">WhatsApp (alıcı hat, E.164)</p>
                <Input
                  value={editingRow.whatsappPhoneE164}
                  onChange={(event) => updateCell(editingRow.id, "whatsappPhoneE164", event.target.value)}
                  placeholder="+905551234567"
                  className="font-mono text-sm"
                  disabled={gridReadOnly}
                />
                <p className="text-xs text-slate-500">
                  Webhook&apos;ta gelen &quot;To&quot; numarası bu değerle eşleşince mesaj işletmeye bağlanır.
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter className="justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={gridReadOnly}
              onClick={() => {
                if (editingRow) setDeleteTargetId(editingRow.id);
              }}
            >
              İşletmeyi Sil
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (editingRow) markDirty(editingRow.id);
                setEditingRowId(null);
              }}
            >
              Tamam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(next) => !next && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem seçili işletmeyi kalıcı olarak siler. İşleme devam etmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTargetId(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteTargetId) {
                  void deleteCompanyRow(deleteTargetId);
                }
              }}
            >
              Evet, Sil
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
