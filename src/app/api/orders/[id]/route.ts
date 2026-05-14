import { ItemCategory, Shift } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishSse } from "@/lib/sse";
import { ALL_CATEGORIES } from "@/lib/categories";
import { createOrderActivity, ORDER_ACTIVITY_TYPES } from "@/lib/order-activity";
import { customerOrderUpdateSchema, updateOrderSchema } from "@/lib/validations";

function flattenShiftQuantities(quantities: {
  morning: Record<ItemCategory, number>;
  evening: Record<ItemCategory, number>;
  night: Record<ItemCategory, number>;
}) {
  const shifts: Array<{ key: "morning" | "evening" | "night"; shift: Shift }> = [
    { key: "morning", shift: "MORNING" },
    { key: "evening", shift: "EVENING" },
    { key: "night", shift: "NIGHT" },
  ];
  return shifts.flatMap(({ key, shift }) =>
    ALL_CATEGORIES.map((category) => ({
      shift,
      category,
      quantity: quantities[key][category] ?? 0,
    })),
  );
}

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const session = await getServerSession(authOptions);
  const { id } = await context.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { company: true, items: true, activities: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  const isAdmin = session?.user?.role === "ADMIN";
  const isOwner =
    session?.user?.role === "CUSTOMER" &&
    session.user.companyId &&
    session.user.companyId === order.companyId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Bu siparişi görüntüleme yetkiniz yok." }, { status: 401 });
  }

  return NextResponse.json(order);
}

export async function PATCH(request: Request, context: Context) {
  const session = await getServerSession(authOptions);
  const { id } = await context.params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  if (session?.user?.role === "ADMIN") {
    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id },
        data: {
          ...(parsed.data.contactName !== undefined ? { contactName: parsed.data.contactName } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.quantities
            ? {
                items: {
                  deleteMany: {},
                  create: flattenShiftQuantities(parsed.data.quantities),
                },
              }
            : {}),
        },
        include: { company: true, items: true },
      });

      const changed: string[] = [];
      if (parsed.data.contactName !== undefined) changed.push("contactName");
      if (parsed.data.notes !== undefined) changed.push("notes");
      if (parsed.data.status !== undefined) changed.push("status");
      if (parsed.data.quantities !== undefined) changed.push("quantities");

      if (changed.length > 0) {
        await createOrderActivity(tx, {
          orderId: id,
          type: ORDER_ACTIVITY_TYPES.ADMIN_UPDATE,
          meta: { fields: changed },
        });
      }

      return next;
    });

    void publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });
    return NextResponse.json(updated);
  }

  if (
    session?.user?.role === "CUSTOMER" &&
    session.user.companyId &&
    session.user.companyId === order.companyId
  ) {
    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: "Bu sipariş artık düzenlenemez. Ek adet için «Üzerine ekle» kullanın." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = customerOrderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id },
        data: {
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          items: {
            deleteMany: {},
            create: flattenShiftQuantities(parsed.data.quantities),
          },
        },
        include: { company: true, items: true },
      });

      await createOrderActivity(tx, {
        orderId: id,
        type: ORDER_ACTIVITY_TYPES.CUSTOMER_UPDATE,
        meta: { notes: parsed.data.notes !== undefined },
      });

      return next;
    });

    void publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
}

export async function DELETE(_: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  await db.order.delete({ where: { id } });
  void publishSse({ type: "order.deleted", orderId: id, ts: Date.now() });
  return NextResponse.json({ ok: true });
}
