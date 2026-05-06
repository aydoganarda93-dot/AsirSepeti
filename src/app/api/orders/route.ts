import { ItemCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ALL_CATEGORIES } from "@/lib/categories";
import { assertOrderDateWindow, createOrderSchema } from "@/lib/validations";

function toItems(quantities: Record<ItemCategory, number>) {
  return ALL_CATEGORIES.map((category) => ({
    category,
    quantity: quantities[category] ?? 0,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Tarih zorunludur." }, { status: 400 });
  }

  const target = new Date(date);
  const orders = await db.order.findMany({
    where: { orderDate: target },
    include: { company: true, items: true },
    orderBy: { company: { name: "asc" } },
  });

  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const validDate = assertOrderDateWindow(parsed.data.orderDate);
  const input = parsed.data;

  const company =
    input.companyId
      ? await db.company.findUnique({ where: { id: input.companyId } })
      : await db.company.upsert({
          where: { name: input.companyName ?? "" },
          update: {},
          create: { name: input.companyName ?? "Yeni Firma" },
        });

  if (!company) {
    return NextResponse.json({ error: "Firma bulunamadı." }, { status: 404 });
  }

  const order = await db.order.upsert({
    where: {
      companyId_orderDate: {
        companyId: company.id,
        orderDate: validDate,
      },
    },
    update: {
      contactName: input.contactName,
      notes: input.notes,
      items: {
        deleteMany: {},
        create: toItems(input.quantities),
      },
    },
    create: {
      companyId: company.id,
      contactName: input.contactName,
      orderDate: validDate,
      notes: input.notes,
      items: {
        create: toItems(input.quantities),
      },
    },
    include: {
      company: true,
      items: true,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
