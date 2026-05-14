import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { mergeOrderHintsByCompany } from "@/lib/company-grid-order-hints";
import { parseDateOnlyUtc } from "@/lib/date";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** `date`: yyyy-MM-dd — sipariş teslim tarihi (Order.orderDate) ile aynı takvim günü */
export async function GET(request: Request) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date");
  if (!dateRaw) {
    return NextResponse.json({ error: "date (yyyy-MM-dd) zorunlu." }, { status: 400 });
  }
  const orderDate = parseDateOnlyUtc(dateRaw);
  if (!orderDate) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }

  const orders = await db.order.findMany({
    where: { orderDate },
    select: {
      companyId: true,
      items: { select: { shift: true, category: true, quantity: true } },
    },
  });

  const entries = orders.map((o) => ({
    companyId: o.companyId,
    items: o.items.map((i) => ({
      shift: i.shift,
      category: i.category,
      quantity: i.quantity,
    })),
  }));

  const merged = mergeOrderHintsByCompany(entries);
  const companies = [...merged.entries()].map(([companyId, hints]) => ({
    companyId,
    ...hints,
  }));

  return NextResponse.json({ date: dateRaw, companies });
}
