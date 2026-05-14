"use client";

import { signOut } from "next-auth/react";

export function AdminLogoutButton() {
  return (
    <button
      type="button"
      className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      onClick={() => signOut({ callbackUrl: "/giris" })}
    >
      Çıkış Yap
    </button>
  );
}
