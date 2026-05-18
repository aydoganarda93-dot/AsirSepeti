import { ItemCategory, OrderKind, Prisma, Shift } from "@prisma/client";
import { db } from "@/lib/db";
import { ALL_CATEGORIES } from "@/lib/categories";
import { assertOrderDateWindow } from "@/lib/validations";
import type { FormQuantities } from "@/lib/order-form";
import { parseQuickOrderText } from "@/lib/parse-quick-order-text";
import { ORDER_ACTIVITY_TYPES } from "@/lib/order-activity";
import { publishSse } from "@/lib/sse";

function toItems(q: FormQuantities) {
  const shifts: Array<{ key: keyof FormQuantities; shift: Shift }> = [
    { key: "morning", shift: "MORNING" },
    { key: "evening", shift: "EVENING" },
    { key: "night", shift: "NIGHT" },
  ];
  return shifts.flatMap(({ key, shift }) =>
    ALL_CATEGORIES.map((category) => ({
      shift,
      category,
      quantity: q[key][category as ItemCategory] ?? 0,
    })),
  );
}

export async function promoteInboundMessageToOrder(inboundId: string, orderDateRaw: string) {
  const inbound = await db.inboundMessage.findUnique({
    where: { id: inboundId },
    include: { company: true },
  });
  if (!inbound) {
    throw new Error("Kayıt bulunamadı.");
  }
  if (inbound.status !== "PENDING_REVIEW") {
    throw new Error("Bu kayıt siparişe çevrilemez.");
  }
  if (!inbound.companyId) {
    throw new Error("İşletme eşleşmesi yok.");
  }

  const parsed = parseQuickOrderText(inbound.rawBody);
  if (parsed.appliedTokens === 0) {
    throw new Error("Metinden adet çıkarılamadı.");
  }

  const validDate = assertOrderDateWindow(orderDateRaw);

  const existing = await db.order.findFirst({
    where: {
      companyId: inbound.companyId,
      orderDate: validDate,
      kind: OrderKind.STANDARD,
    },
  });
  if (existing) {
    throw new Error("Bu teslim tarihinde ana sipariş zaten var; catering veya düzenleme kullanın.");
  }

  const notes = `[WhatsApp ${inbound.fromPhoneNorm}]\n${inbound.rawBody}`.slice(0, 2000);

  let order;
  try {
    order = await db.order.create({
      data: {
        companyId: inbound.companyId,
        contactName: "WhatsApp",
        orderDate: validDate,
        notes,
        kind: OrderKind.STANDARD,
        items: {
          create: toItems(parsed.quantities),
        },
      },
      include: { company: true, items: true },
    });
  } catch (err) {
    // Race: promote ile eşzamanlı başka kanal (müşteri / admin) aynı gün STANDARD açtı.
    // Order_companyId_orderDate_standard_key partial unique index P2002 fırlatır.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("Bu teslim tarihinde ana sipariş zaten var; catering veya düzenleme kullanın.");
    }
    throw err;
  }

  await db.orderActivity.create({
    data: {
      orderId: order.id,
      type: ORDER_ACTIVITY_TYPES.ORDER_CREATED,
      meta: { source: "inbound_whatsapp", inboundId },
    },
  });

  await db.inboundMessage.update({
    where: { id: inboundId },
    data: {
      status: "ORDER_CREATED",
      orderId: order.id,
      parseAppliedTokens: parsed.appliedTokens,
    },
  });

  void publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });

  return order;
}
