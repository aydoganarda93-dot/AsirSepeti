import { ItemStatus, OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishSse } from "@/lib/sse";
import { statusUpdateSchema } from "@/lib/validations";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = statusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nextItemStatus: ItemStatus = parsed.data.itemStatus ?? ItemStatus.PREPARING;
  const nextOrderStatus: OrderStatus = parsed.data.orderStatus ?? OrderStatus.PREPARING;

  const order = await db.order.update({
    where: { id },
    data: {
      status: nextOrderStatus,
      items: parsed.data.itemCategory
        ? {
            updateMany: {
              where: { category: parsed.data.itemCategory },
              data: { status: nextItemStatus },
            },
          }
        : undefined,
    },
  });
  publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });

  return NextResponse.json(order);
}
