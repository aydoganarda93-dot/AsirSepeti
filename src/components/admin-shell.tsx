"use client";

import {
  Building2,
  ClipboardList,
  FileText,
  Home,
  Menu,
  MessageSquare,
  PlusCircle,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminOrderAlerts } from "@/components/admin-order-alerts";
import { AdminUserMenu } from "@/components/admin-user-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AdminShellUser = {
  email: string;
  displayName: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badgeCount?: number;
};

type Props = {
  children: React.ReactNode;
  user: AdminShellUser;
  pendingWhatsapp: number;
};

function NavLinks({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: NavItem[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  function isActive(href: string) {
    const path = pathname ?? "";
    if (href === "/admin") return path === "/admin";
    return path === href || path.startsWith(`${href}/`);
  }

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {navItems.map(({ href, label, icon: Icon, badgeCount }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(href) ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badgeCount != null ? (
            <Badge
              variant="secondary"
              className={cn(
                "ml-auto shrink-0 px-1.5 py-0 text-[10px]",
                isActive(href) ? "border-white/20 bg-white/15 text-white" : "bg-amber-100 text-amber-900",
              )}
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </Badge>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({ children, user, pendingWhatsapp }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/admin", label: "Ana sayfa", icon: Home },
    { href: "/admin/isletmeler", label: "İşletmeler", icon: Building2 },
    { href: "/admin/siparis-gecmisi", label: "Sipariş geçmişi", icon: ClipboardList },
    { href: "/admin/catering", label: "Bekleyen siparişlerim", icon: UtensilsCrossed },
    { href: "/admin/manual-yemek", label: "Manuel yemek", icon: PlusCircle },
    { href: "/admin/aylik-menu", label: "Menü yönetimi", icon: FileText },
    {
      href: "/admin/whatsapp-kuyruk",
      label: "WhatsApp kuyruk",
      icon: MessageSquare,
      badgeCount: pendingWhatsapp > 0 ? pendingWhatsapp : undefined,
    },
    { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100/80">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] md:hidden"
          aria-label="Menüyü kapat"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 md:static md:z-0 md:translate-x-0 md:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 md:border-0 md:px-4 md:pt-4">
          <Link href="/admin" className="font-bold tracking-tight text-slate-900" onClick={() => setMobileOpen(false)}>
            Asır Sepeti
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Kapat"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks navItems={navItems} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
        <div className="border-t border-slate-100 p-3">
          <AdminOrderAlerts />
        </div>
        <div className="hidden border-t border-slate-100 p-3 md:block">
          <AdminUserMenu email={user.email} displayName={user.displayName} align="left" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
          >
            <Menu className="h-4 w-4" aria-hidden />
            Menü
          </button>
          <AdminUserMenu email={user.email} displayName={user.displayName} />
        </header>
        <main className="flex-1 overflow-x-hidden p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
