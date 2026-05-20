"use client";

import { Check, ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CompanyOrderGridHints } from "@/lib/company-grid-order-hints";
import { parseCellNumber } from "./companies-grid-utils";

export type GridRowFields = {
  id: string;
  companyName: string;
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
};

export type GridFieldKey = keyof GridRowFields;

const NUMERIC_FIELDS = new Set<GridFieldKey>([
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

type CellVariant = "adet" | "ekmek" | "kumanya" | "text" | "cesit";

type SectionKey = "oglen" | "aksam" | "gece";

type SectionState = Record<SectionKey, boolean>;

const DEFAULT_SECTIONS: SectionState = { oglen: false, aksam: false, gece: false };

function CesitDisplay({ value }: { value: string }) {
  const t = value.trim();
  if (!t) return <span className="text-slate-300">—</span>;
  const looksLikeKap = /^\d/i.test(t) && /kap/i.test(t);
  if (looksLikeKap) {
    return (
      <Badge variant="secondary" className="border border-sky-200/80 bg-sky-50 font-medium text-sky-900">
        {t}
      </Badge>
    );
  }
  return <span className="text-sm text-slate-700">{t}</span>;
}

function stripHintSuffix(hint: string): string {
  return hint.replace(/\s*(kum|düz|arası)\s*$/i, "").trim();
}

function GridValueDisplay({
  value,
  variant,
  orderHint,
  showHint,
}: {
  value: string;
  variant: CellVariant;
  orderHint?: string | null;
  showHint?: boolean;
}) {
  const n = parseCellNumber(value);
  const hintRaw = showHint && orderHint ? stripHintSuffix(orderHint) : "";
  const hintN = hintRaw ? parseCellNumber(hintRaw) : 0;
  const effective = n > 0 ? n : hintN;

  if (effective === 0) {
    return <span className="text-sm text-slate-300">—</span>;
  }

  if (variant === "text" || variant === "cesit") {
    return <span className="text-sm text-slate-700">{value.trim() || "—"}</span>;
  }

  const badgeClass =
    variant === "kumanya"
      ? "border-amber-100 bg-amber-50 font-bold text-amber-800"
      : variant === "ekmek"
        ? "border-blue-100 bg-blue-50 font-bold text-blue-800"
        : "border-slate-200 bg-slate-900/[0.06] font-bold text-slate-900";

  const fromOrder = n === 0 && hintN > 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <span
        className={cn(
          "inline-flex min-w-[2rem] items-center justify-center rounded-md border px-2 py-0.5 text-sm tabular-nums",
          badgeClass,
          fromOrder && "ring-1 ring-blue-200/60",
        )}
      >
        {effective}
      </span>
      {fromOrder ? (
        <span className="rounded bg-blue-100/80 px-1 py-px text-[10px] font-medium text-blue-700">sipariş</span>
      ) : null}
    </div>
  );
}

function GridCellEditor({
  value,
  numeric,
  editing,
  onChange,
  onCommit,
  onCancel,
  placeholder,
}: {
  value: string;
  numeric?: boolean;
  editing: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  if (!editing) return null;
  return (
    <input
      autoFocus
      type="text"
      inputMode={numeric ? "numeric" : "text"}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        onChange(numeric ? v.replace(/[^\d]/g, "") : v);
      }}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="h-9 w-full min-w-[3rem] rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-medium tabular-nums shadow-sm outline-none ring-2 ring-slate-400/30 focus:ring-slate-500/40"
    />
  );
}

type CompaniesDataGridProps = {
  rows: GridRowFields[];
  gridReadOnly: boolean;
  orderHintsByCompany: Map<string, CompanyOrderGridHints>;
  getDraftOrRow: (row: GridRowFields, field: GridFieldKey) => string;
  isCellDirty: (rowId: string, field: GridFieldKey) => boolean;
  isEditing: (rowId: string, field: GridFieldKey) => boolean;
  beginEditCell: (rowId: string, field: GridFieldKey, current: string) => void;
  commitCell: (rowId: string, field: GridFieldKey, raw: string) => void;
  cancelEditCell: () => void;
  setDraftValue: (v: string) => void;
  onOpenCompanyDialog: (rowId: string) => void;
  onSaveRow: (rowId: string) => Promise<void>;
  savingRowId: string | null;
};

export function CompaniesDataGrid({
  rows,
  gridReadOnly,
  orderHintsByCompany,
  getDraftOrRow,
  isCellDirty,
  isEditing,
  beginEditCell,
  commitCell,
  cancelEditCell,
  setDraftValue,
  onOpenCompanyDialog,
  onSaveRow,
  savingRowId,
}: CompaniesDataGridProps) {
  const [sections, setSections] = useState<SectionState>(DEFAULT_SECTIONS);
  const [rowEditId, setRowEditId] = useState<string | null>(null);

  const toggleSection = (key: SectionKey) => {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const oglenSubCols = sections.oglen ? 3 : 0;
  const aksamSubCols = sections.aksam ? 3 : 0;
  const geceSubCols = sections.gece ? 2 : 0;
  const oglenColSpan = 1 + oglenSubCols;
  const aksamColSpan = 1 + aksamSubCols;
  const geceColSpan = 1 + geceSubCols;

  const startRowEdit = useCallback((rowId: string) => {
    if (gridReadOnly) return;
    setRowEditId(rowId);
    cancelEditCell();
  }, [gridReadOnly, cancelEditCell]);

  const cancelRowEdit = useCallback(() => {
    setRowEditId(null);
    cancelEditCell();
  }, [cancelEditCell]);

  const renderCell = (
    row: GridRowFields,
    field: GridFieldKey,
    variant: CellVariant,
    opts?: { orderHint?: string | null; placeholder?: string; align?: string },
  ) => {
    const oh = orderHintsByCompany.get(row.id);
    const hintKey = field === "oglen" ? "oglenOrderLine"
      : field === "oglenEkmek" ? "oglenEkmekOrderLine"
      : field === "oglenEkmekArasi" ? "oglenEkmekArasiOrderLine"
      : field === "oglenKumanya" ? "oglenKumanyaOrderLine"
      : field === "aksam" ? "aksamOrderLine"
      : field === "aksamEkmek" ? "aksamEkmekOrderLine"
      : field === "aksamEkmekArasi" ? "aksamEkmekArasiOrderLine"
      : field === "aksamKumanya" ? "aksamKumanyaOrderLine"
      : field === "gece" ? "geceOrderLine"
      : field === "geceEkmek" ? "geceEkmekOrderLine"
      : field === "geceKumanya" ? "geceKumanyaOrderLine"
      : null;
    const orderHint = opts?.orderHint ?? (hintKey && oh ? oh[hintKey as keyof CompanyOrderGridHints] : null);
    const rowEditing = rowEditId === row.id;
    const cellEditing = isEditing(row.id, field);
    const value = getDraftOrRow(row, field);
    const numeric = NUMERIC_FIELDS.has(field);

    const openCellEdit = () => {
      if (gridReadOnly) return;
      if (!rowEditing) startRowEdit(row.id);
      beginEditCell(row.id, field, String(row[field] ?? ""));
    };

    return (
      <td
        className={cn(
          "border-b border-slate-100 px-3 py-4 align-middle transition-colors duration-200",
          opts?.align,
        )}
        onDoubleClick={() => openCellEdit()}
      >
        {cellEditing && rowEditing ? (
          <GridCellEditor
            value={value}
            numeric={numeric}
            editing
            onChange={setDraftValue}
            onCommit={() => commitCell(row.id, field, value)}
            onCancel={cancelEditCell}
            placeholder={opts?.placeholder}
          />
        ) : (
          <button
            type="button"
            disabled={gridReadOnly}
            onClick={() => rowEditing && openCellEdit()}
            onDoubleClick={(e) => {
              e.preventDefault();
              openCellEdit();
            }}
            className={cn(
              "flex min-h-[2.5rem] w-full flex-col items-center justify-center gap-1 rounded-lg transition-colors",
              rowEditing && "cursor-pointer hover:bg-slate-50",
              !rowEditing && "cursor-default",
            )}
          >
            {variant === "cesit" ? (
              <CesitDisplay value={value} />
            ) : (
              <GridValueDisplay
                value={value}
                variant={variant}
                orderHint={orderHint}
                showHint={!isCellDirty(row.id, field)}
              />
            )}
          </button>
        )}
      </td>
    );
  };

  const SectionToggle = ({ section, label }: { section: SectionKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-slate-200/60"
      aria-expanded={sections[section]}
    >
      {sections[section] ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="max-h-[72vh] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-slate-200 bg-slate-100/80 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <th className="sticky left-0 z-30 w-12 border-r border-slate-200 bg-slate-100/95 px-2 py-3 text-center backdrop-blur-sm">
                #
              </th>
              <th className="sticky left-12 z-30 min-w-[180px] border-r border-slate-200 bg-slate-100/95 px-4 py-3 text-left backdrop-blur-sm">
                Firma
              </th>
              <th className="border-r border-slate-200 bg-slate-100/95 px-3 py-3">
                <span className="block">Çeşit</span>
                <span className="mt-0.5 block text-[9px] font-normal normal-case text-slate-500">
                  Sabit
                </span>
              </th>
              <th colSpan={oglenColSpan} className="border-r border-slate-200 bg-slate-100/95 px-2 py-3 text-center">
                <SectionToggle section="oglen" label="Öğle servisi" />
              </th>
              <th colSpan={aksamColSpan} className="border-r border-slate-200 bg-slate-100/95 px-2 py-3 text-center">
                <SectionToggle section="aksam" label="Akşam servisi" />
              </th>
              <th colSpan={geceColSpan} className="border-r border-slate-200 bg-slate-100/95 px-2 py-3 text-center">
                <SectionToggle section="gece" label="Gece servisi" />
              </th>
              <th className="bg-slate-100/95 px-3 py-3 text-left">
                <span className="block">Açıklama</span>
                <span className="mt-0.5 block text-[9px] font-normal normal-case text-slate-500">
                  Sabit
                </span>
              </th>
              <th className="w-28 bg-slate-100/95 px-2 py-3 text-center">İşlem</th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-medium text-slate-500">
              <th className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50" />
              <th className="sticky left-12 z-20 border-r border-slate-200 bg-slate-50" />
              <th className="border-r border-slate-200 px-2 py-2" />
              <th className="border-r border-slate-200 px-2 py-2">Adet</th>
              {sections.oglen ? (
                <>
                  <th className="border-r border-slate-200 px-2 py-2 transition-all">Ekmek</th>
                  <th className="border-r border-slate-200 px-2 py-2 transition-all">Ekmek Arası</th>
                  <th className="border-r border-slate-200 px-2 py-2 transition-all">Kumanya</th>
                </>
              ) : null}
              <th className="border-r border-slate-200 px-2 py-2">Adet</th>
              {sections.aksam ? (
                <>
                  <th className="border-r border-slate-200 px-2 py-2">Ekmek</th>
                  <th className="border-r border-slate-200 px-2 py-2">Ekmek Arası</th>
                  <th className="border-r border-slate-200 px-2 py-2">Kumanya</th>
                </>
              ) : null}
              <th className="border-r border-slate-200 px-2 py-2">Adet</th>
              {sections.gece ? (
                <>
                  <th className="border-r border-slate-200 px-2 py-2">Ekmek</th>
                  <th className="border-r border-slate-200 px-2 py-2">Kumanya</th>
                </>
              ) : null}
              <th className="px-2 py-2">Metin</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const oh = orderHintsByCompany.get(row.id);
              const zebra = index % 2 === 1;
              const rowEditing = rowEditId === row.id;
              const stickyBg = zebra ? "bg-slate-50/80" : "bg-white";

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "group border-b border-slate-100 transition-colors duration-200 hover:bg-slate-50/80",
                    rowEditing && "bg-amber-50/40 ring-1 ring-inset ring-amber-200/80",
                    zebra && !rowEditing && "bg-slate-50/50",
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 border-r border-slate-100 px-2 py-4 text-center text-xs tabular-nums text-slate-400",
                      stickyBg,
                      "group-hover:bg-slate-50/80",
                    )}
                  >
                    {index + 1}
                  </td>
                  <td
                    className={cn(
                      "sticky left-12 z-10 border-r border-slate-100 px-4 py-3 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.06)]",
                      stickyBg,
                      "group-hover:bg-slate-50/80",
                    )}
                  >
                    <button
                      type="button"
                      className="truncate text-left text-sm font-semibold text-slate-800 hover:text-slate-950 hover:underline"
                      onClick={() => onOpenCompanyDialog(row.id)}
                    >
                      {row.companyName || "Yeni İşletme"}
                    </button>
                  </td>
                  {renderCell(row, "cesit", "cesit")}
                  {renderCell(row, "oglen", "adet", { orderHint: oh?.oglenOrderLine ?? null })}
                  {sections.oglen ? (
                    <>
                      {renderCell(row, "oglenEkmek", "ekmek")}
                      {renderCell(row, "oglenEkmekArasi", "ekmek")}
                      {renderCell(row, "oglenKumanya", "kumanya")}
                    </>
                  ) : null}
                  {renderCell(row, "aksam", "adet")}
                  {sections.aksam ? (
                    <>
                      {renderCell(row, "aksamEkmek", "ekmek")}
                      {renderCell(row, "aksamEkmekArasi", "ekmek")}
                      {renderCell(row, "aksamKumanya", "kumanya")}
                    </>
                  ) : null}
                  {renderCell(row, "gece", "adet")}
                  {sections.gece ? (
                    <>
                      {renderCell(row, "geceEkmek", "ekmek")}
                      {renderCell(row, "geceKumanya", "kumanya")}
                    </>
                  ) : null}
                  {renderCell(row, "aciklama", "text", { placeholder: "Not", align: "text-left" })}
                  <td className="px-2 py-3 align-middle">
                    {gridReadOnly ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : rowEditing ? (
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1 bg-slate-900 text-xs hover:bg-slate-800"
                          disabled={savingRowId === row.id}
                          onClick={() => {
                            void onSaveRow(row.id).then(() => cancelRowEdit()).catch(() => undefined);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {savingRowId === row.id ? "…" : "Kaydet"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={cancelRowEdit}>
                          <X className="h-3.5 w-3.5" />
                          İptal
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-full gap-1 border-slate-200 text-xs opacity-70 transition-opacity group-hover:opacity-100"
                        onClick={() => startRowEdit(row.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Düzenle
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Aramaya uygun işletme yok.</p>
        ) : null}
      </div>
    </div>
  );
}
