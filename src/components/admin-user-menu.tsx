"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  displayName: string;
  /** Menü yatay hizası */
  align?: "left" | "right";
  /** `above`: tetikleyicinin üstüne (sidebar altı için); `below`: altına (üst çubuk için) */
  menuPlacement?: "above" | "below";
};

export function AdminUserMenu({ email, displayName, align = "right", menuPlacement }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (displayName || email).trim().charAt(0).toUpperCase() || "?";

  const openUp = menuPlacement === "above" || (menuPlacement === undefined && align === "left");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-sm shadow-sm transition hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {initial}
        </span>
        <span className="hidden min-w-0 flex-1 flex-col sm:flex">
          <span className="truncate font-semibold text-slate-900">{displayName}</span>
          <span className="truncate text-xs text-slate-500">{email}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[60] min-w-[14rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5",
            align === "right" ? "right-0" : "left-0",
            openUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 text-xs text-slate-600">
            <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="break-all">{email}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => void signOut({ callbackUrl: "/giris" })}
          >
            <LogOut className="h-4 w-4 text-slate-500" aria-hidden />
            Çıkış yap
          </button>
        </div>
      ) : null}
    </div>
  );
}
