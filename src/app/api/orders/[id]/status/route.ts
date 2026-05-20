import { ItemStatus, OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import {
  computeGridDeltasFromOrderItems,
  hasGridDeltas,
  mergeCompanyAdminNoteWithDeltas,
} from "@/lib/company-admin-grid";
import { db } from "@/lib/db";
import { createOrderActivity, ORDER_ACTIVITY_TYPES } from "@/lib/order-activity";
import { publishSse } from "@/lib/sse";
import { statusUpdateSchema } from "@/lib/validations";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = statusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nextItemStatus: ItemStatus = parsed.data.itemStatus ?? ItemStatus.PREPARING;
  const requestedOrderStatus = parsed.data.orderStatus as OrderStatus | undefined;

  const order = await db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id },
      include: { items: true, company: true },
    });
    if (!current) {
      return null;
    }

    const prevStatus = current.status;
    const nextOrderStatus = requestedOrderStatus ?? prevStatus;

    const deltas = computeGridDeltasFromOrderItems(current.items);

    const shouldApplyGrid =
      nextOrderStatus === OrderStatus.CONFIRMED &&
      prevStatus === OrderStatus.PENDING &&
      current.gridAppliedAt === null &&
      hasGridDeltas(deltas);

    const shouldRevertGrid =
      prevStatus === OrderStatus.CONFIRMED &&
      nextOrderStatus === OrderStatus.PENDING &&
      current.gridAppliedAt !== null &&
      hasGridDeltas(deltas);

    if (shouldApplyGrid) {
      const nextAdminNote = mergeCompanyAdminNoteWithDeltas(current.company.adminNote, deltas, 1);
      await tx.company.update({
        where: { id: current.companyId },
        data: { adminNote: nextAdminNote },
      });
    } else if (shouldRevertGrid) {
      const nextAdminNote = mergeCompanyAdminNoteWithDeltas(current.company.adminNote, deltas, -1);
      await tx.company.update({
        where: { id: current.companyId },
        data: { adminNote: nextAdminNote },
      });
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        ...(requestedOrderStatus !== undefined ? { status: requestedOrderStatus } : {}),
        ...(shouldApplyGrid ? { gridAppliedAt: new Date() } : {}),
        ...(shouldRevertGrid ? { gridAppliedAt: null } : {}),
        ...(parsed.data.itemCategory
          ? {
              items: {
                updateMany: {
                  where: {
                    category: parsed.data.itemCategory,
                    shift: parsed.data.shift,
                  },
                  data: { status: nextItemStatus },
                },
              },
            }
          : {}),
      },
      include: { company: true, items: true },
    });

    if (requestedOrderStatus !== undefined && requestedOrderStatus !== prevStatus) {
      await createOrderActivity(tx, {
        orderId: id,
        type: ORDER_ACTIVITY_TYPES.STATUS_CHANGED,
        meta: { from: prevStatus, to: requestedOrderStatus },
      });
    }

    return updated;
  });

  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  void publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });

  return NextResponse.json(order);
}
