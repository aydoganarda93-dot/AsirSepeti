import { ItemCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { ALL_CATEGORIES } from "@/lib/categories";

export async function GET(request: Request) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Tarih zorunludur." }, { status: 400 });
  }

  const start = new Date(date);
  const rows = await db.orderItem.groupBy({
    by: ["category"],
    _sum: { quantity: true },
    where: {
      order: { orderDate: start },
    },
  });

  const totals: Record<ItemCategory, number> = {
    OGLEN_YEMEGI: 0,
    KAPALI_KAP: 0,
    SEFERTASI: 0,
    SALATA: 0,
    KUMANYA: 0,
    TATLI: 0,
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
