"use client";

import { cn } from "@/lib/utils";

export type CustomerOrderTab = "quick" | "detailed";

type Props = {
  tab: CustomerOrderTab;
  onTabChange: (tab: CustomerOrderTab) => void;
  quickPanel: React.ReactNode;
  detailedPanel: React.ReactNode;
};

export function CustomerOrderTabs({ tab, onTabChange, quickPanel, detailedPanel }: Props) {
  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Sipariş giriş modu"
        className="flex gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quick"}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
            tab === "quick"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
              : "text-slate-600 hover:text-slate-900",
          )}
          onClick={() => onTabChange("quick")}
        >
          Hızlı giriş
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "detailed"}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
            tab === "detailed"
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
              : "text-slate-600 hover:text-slate-900",
          )}
          onClick={() => onTabChange("detailed")}
        >
          Detaylı giriş
        </button>
      </div>
      <div role="tabpanel" className="min-h-[120px]">
        {tab === "quick" ? quickPanel : detailedPanel}
      </div>
    </div>
  );
}
