import { ItemCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { ALL_CATEGORIES } from "@/lib/categories";
import { parseDateOnlyUtc } from "@/lib/date";

export async function GET(request: Request) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Tarih zorunludur." }, { status: 400 });
  }

  const start = parseDateOnlyUtc(date);
  if (!start) {
    return NextResponse.json({ error: "Geçersiz tarih formatı." }, { status: 400 });
  }
  const rows = await db.orderItem.groupBy({
    by: ["category"],
    _sum: { quantity: true },
    where: {
      order: { orderDate: start },
    },
  });

  const totals: Record<ItemCategory, number> = {
    KUMANYA: 0,
    OGLEN_YEMEGI: 0,
    EKMEK_ARASI: 0,
  };

  rows.forEach((row) => {
    totals[row.category] = row._sum.quantity ?? 0;
  });

  return NextResponse.json({
    date,
    totals,
    categories: ALL_CATEGORIES,
  });
}
