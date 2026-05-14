import { OrderKind } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnlyUtc, startOfUtcCalendarDay } from "@/lib/date";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "CUSTOMER" || !session.user.companyId) {
    return NextResponse.json(
      { error: "Bu sayfa işletme hesabı ile açılır. Önce giriş yapın." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const now = new Date();
  const from = fromStr ? parseDateOnlyUtc(fromStr) : startOfUtcCalendarDay(0, now);
  const to = toStr ? parseDateOnlyUtc(toStr) : startOfUtcCalendarDay(365, now);
  if (!from || !to) {
    return NextResponse.json({ error: "Tarih aralığı geçersiz." }, { status: 400 });
  }

  const companyId = session.user.companyId;

  /** Tek kayıt: tekrarla butonu — önce ana sipariş, yoksa en son oluşturulan */
  if (searchParams.get("latest") === "1") {
    let order = await db.order.findFirst({
      where: {
        companyId,
        orderDate: { gte: from, lte: to },
        kind: OrderKind.STANDARD,
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    if (!order) {
      order = await db.order.findFirst({
        where: {
          companyId,
          orderDate: { gte: from, lte: to },
        },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      });
    }
    return NextResponse.json({ order });
  }

  const orders = await db.order.findMany({
    where: {
      companyId,
      orderDate: { gte: from, lte: to },
    },
    include: { items: true },
    orderBy: [{ orderDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(orders);
}
