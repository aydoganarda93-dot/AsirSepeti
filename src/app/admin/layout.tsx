import { getServerSession } from "next-auth";
import { AdminShell } from "@/components/admin-shell";
import { authOptions } from "@/lib/auth";
import { getPendingInboundReviewCount } from "@/lib/admin-dashboard-stats";
import { adminDisplayName } from "@/lib/admin-greeting";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions);
  const pendingWhatsapp = await getPendingInboundReviewCount();
  const email = session?.user?.email ?? "";
  const displayName = adminDisplayName(session);

  return (
    <AdminShell user={{ email, displayName }} pendingWhatsapp={pendingWhatsapp}>
      {children}
    </AdminShell>
  );
}
