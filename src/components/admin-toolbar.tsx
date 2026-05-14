"use client";

import { ItemCategory } from "@prisma/client";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";

type Props = {
  date: string;
  companyFilter: string;
  categoryFilter: string;
  notesOnly: boolean;
  sortBy: "name" | "total";
  onDate: (v: string) => void;
  onCompany: (v: string) => void;
  onCategory: (v: string) => void;
  onNotesOnly: (v: boolean) => void;
  onSort: (v: "name" | "total") => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
};

export function AdminToolbar({
  date,
  companyFilter,
  categoryFilter,
  notesOnly,
  sortBy,
  onDate,
  onCompany,
  onCategory,
  onNotesOnly,
  onSort,
  onExportExcel,
  onExportCsv,
}: Props) {
  return (
    <>
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Admin Paneli</h1>
          <a href="/admin/users" className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition">
            Kullanıcı Yönetimi
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="rounded border p-2" />
          <button className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white" onClick={onExportExcel}>
            Excel İndir
          </button>
          <button className="rounded bg-slate-700 px-3 py-2 text-sm font-semibold text-white" onClick={onExportCsv}>
            CSV İndir
          </button>
        </div>
      </header>
      <section className="grid gap-2 rounded-lg border bg-white p-3 md:grid-cols-4">
        <input className="rounded border p-2" placeholder="Firma filtrele" value={companyFilter} onChange={(e) => onCompany(e.target.value)} />
        <select className="rounded border p-2" value={categoryFilter} onChange={(e) => onCategory(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {ALL_CATEGORIES.map((c: ItemCategory) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="rounded border p-2" value={sortBy} onChange={(e) => onSort(e.target.value as "name" | "total")}>
          <option value="name">Firma adına göre</option>
          <option value="total">Toplam adede göre</option>
        </select>
        <label className="flex items-center gap-2 rounded border p-2 text-sm">
          <input type="checkbox" checked={notesOnly} onChange={(e) => onNotesOnly(e.target.checked)} />
          Sadece notu olanlar
        </label>
      </section>
    </>
  );
}
