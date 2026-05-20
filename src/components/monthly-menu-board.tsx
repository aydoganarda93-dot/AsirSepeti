"use client";

import type { MonthlyMenuGridData } from "@/lib/monthly-menu-board";
import { monthlyMenuCellClassName } from "@/lib/monthly-menu-cell-style";
import { cn } from "@/lib/utils";

type Props = {
  data: MonthlyMenuGridData;
};

export function MonthlyMenuBoard({ data }: Props) {
  if (data.grid.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-600">
        Menü dosyası boş veya okunamadı.
      </p>
    );
  }

  const colCount = Math.max(...data.grid.map((r) => r.length));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
      <table className="w-max min-w-full border-collapse text-[11px] leading-tight">
        <tbody>
          {data.grid.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: colCount }, (_, ci) => {
                const text = row[ci]?.trim() ?? "";
                return (
                  <td
                    key={ci}
                    className={cn(
                      "border border-slate-200 px-1.5 py-1 max-w-[9rem] break-words",
                      monthlyMenuCellClassName(text),
                    )}
                  >
                    {text || "\u00a0"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MonthlyMenuBoardSkeleton() {
  return (
    <div className="py-12 text-center text-sm text-slate-500" aria-busy>
      Menü yükleniyor…
    </div>
  );
}

export function MonthlyMenuBoardError({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-red-50 px-3 py-4 text-center text-sm text-red-800" role="alert">
      {message}
    </p>
  );
}
