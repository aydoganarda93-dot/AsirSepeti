import { NextResponse } from "next/server";
import { ItemCategory } from "@prisma/client";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { publishSse } from "@/lib/sse";
import { updateOrderSchema } from "@/lib/validations";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { company: true, items: true },
  });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(request: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await db.order.update({
    where: { id },
    data: {
      contactName: parsed.data.contactName,
      notes: parsed.data.notes ?? undefined,
      status: parsed.data.status,
      items: parsed.data.quantities
        ? {
            deleteMany: {},
            create: Object.entries(parsed.data.quantities).map(([category, quantity]) => ({
              category: category as ItemCategory,
              quantity,
            })),
          }
        : undefined,
    },
    include: { company: true, items: true },
  });
  publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });
  return NextResponse.json(order);
}

export async function DELETE(_: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  await db.order.delete({ where: { id } });
  publishSse({ type: "order.deleted", orderId: id, ts: Date.now() });
  return NextResponse.json({ ok: true });
}
