import { getServerSession } from "next-auth";
import { Building2, ClipboardList, Package } from "lucide-react";
import { AdminModuleCard, type ModuleCardConfig } from "@/components/admin-module-card";
import { Card, CardContent } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getAdminDashboardStats } from "@/lib/admin-dashboard-stats";
import { adminDisplayName } from "@/lib/admin-greeting";
import { formatDateOnlyTr, formatUtcYmdFromOffset } from "@/lib/date";

const MODULES: ModuleCardConfig[] = [
  {
    title: "Catering yönetimi",
    description: "Bekleyen siparişleri onaylayın veya reddedin; operasyonun ana akışı.",
    href: "/admin/catering",
    iconKey: "UtensilsCrossed",
    featured: true,
  },
  {
    title: "İşletmeler",
    description: "Fabrika listesi ve günlük operasyon notları.",
    href: "/admin/isletmeler",
    iconKey: "Building2",
  },
  {
    title: "Sipariş geçmişi",
    description: "Tarih ve işletmeye göre geçmiş siparişler ve dışa aktarım.",
    href: "/admin/siparis-gecmisi",
    iconKey: "ClipboardList",
  },
  {
    title: "Manuel yemek",
    description: "Telefon veya kağıt üzerinden gelen talepleri hızlıca sisteme işleyin.",
    href: "/admin/manual-yemek",
    iconKey: "PlusCircle",
  },
  {
    title: "WhatsApp kuyruk",
    description: "Gelen mesajları inceleyin, siparişe dönüştürün veya reddedin.",
    href: "/admin/whatsapp-kuyruk",
    iconKey: "MessageSquare",
    badgeCount: 0,
  },
  {
    title: "Kullanıcılar",
    description: "Panel erişimi olan hesapları yönetin.",
    href: "/admin/users",
    iconKey: "Users",
  },
];

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const stats = await getAdminDashboardStats();
  const firstName = adminDisplayName(session);
  const todayYmd = formatUtcYmdFromOffset(0);
  const todayLabel = formatDateOnlyTr(todayYmd);

  const modulesWithBadges: ModuleCardConfig[] = MODULES.map((m) =>
    m.href === "/admin/whatsapp-kuyruk" ? { ...m, badgeCount: stats.pendingWhatsapp } : m,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 md:space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Hoş geldin, {firstName}! İşte bugünkü operasyon özeti.
        </h1>
        <p className="text-sm text-slate-600">
          Tarih: <span className="font-medium text-slate-800">{todayLabel}</span> — Modüllere aşağıdan veya soldaki menüden
          ulaşabilirsiniz.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
        <Card className="border-slate-200/90 shadow-sm ring-1 ring-slate-900/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Package className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bugünkü sipariş</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{stats.ordersToday}</p>
              <p className="text-[11px] text-slate-500">Bu teslim günü için kayıtlı sipariş sayısı</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/90 shadow-sm ring-1 ring-slate-900/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <ClipboardList className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bekleyen onay</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{stats.pendingApprovalsToday}</p>
              <p className="text-[11px] text-slate-500">Bugün teslimi için onay bekleyen</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/90 shadow-sm ring-1 ring-slate-900/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
              <Building2 className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aktif işletme</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{stats.companyCount}</p>
              <p className="text-[11px] text-slate-500">Sistemde kayıtlı firma sayısı</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Modüller</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {modulesWithBadges.map((mod) => (
            <AdminModuleCard key={mod.href} module={mod} />
          ))}
        </div>
      </section>
    </div>
  );
}
