import { db } from "@/lib/db";
import { formatUtcYmdFromOffset, parseDateOnlyUtc } from "@/lib/date";

export async function getPendingInboundReviewCount(): Promise<number> {
  return db.inboundMessage.count({
    where: { status: "PENDING_REVIEW" },
  });
}

export type AdminDashboardStats = {
  ordersToday: number;
  pendingApprovalsToday: number;
  companyCount: number;
  pendingWhatsapp: number;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const ymd = formatUtcYmdFromOffset(0);
  const start = parseDateOnlyUtc(ymd);
  if (!start) {
    return { ordersToday: 0, pendingApprovalsToday: 0, companyCount: 0, pendingWhatsapp: 0 };
  }

  const [ordersToday, pendingApprovalsToday, companyCount, pendingWhatsapp] = await Promise.all([
    db.order.count({ where: { orderDate: start } }),
    db.order.count({ where: { orderDate: start, status: "PENDING" } }),
    db.company.count(),
    db.inboundMessage.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return {
    ordersToday,
    pendingApprovalsToday,
    companyCount,
    pendingWhatsapp,
  };
}
