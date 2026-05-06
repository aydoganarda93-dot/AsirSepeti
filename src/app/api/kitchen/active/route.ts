import { addDays, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const orders = await db.order.findMany({
    where: {
      status: { not: "DELIVERED" },
      orderDate: { gte: tomorrow, lt: dayAfter },
    },
    include: { company: true, items: true },
    orderBy: [{ orderDate: "asc" }, { company: { name: "asc" } }],
  });

  return NextResponse.json(orders);
}
