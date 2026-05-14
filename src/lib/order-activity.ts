import type { Prisma } from "@prisma/client";

export const ORDER_ACTIVITY_TYPES = {
  STATUS_CHANGED: "STATUS_CHANGED",
  ITEMS_UPDATED: "ITEMS_UPDATED",
  ADMIN_UPDATE: "ADMIN_UPDATE",
  CUSTOMER_UPDATE: "CUSTOMER_UPDATE",
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_DELETED: "ORDER_DELETED",
  ADMIN_MANUAL_UPSERT: "ADMIN_MANUAL_UPSERT",
} as const;

export type OrderActivityType = (typeof ORDER_ACTIVITY_TYPES)[keyof typeof ORDER_ACTIVITY_TYPES];

export async function createOrderActivity(
  tx: Prisma.TransactionClient,
  input: { orderId: string; type: OrderActivityType; meta?: Prisma.InputJsonValue },
) {
  await tx.orderActivity.create({
    data: {
      orderId: input.orderId,
      type: input.type,
      meta: input.meta ?? undefined,
    },
  });
}
