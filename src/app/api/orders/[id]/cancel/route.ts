import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishSse } from "@/lib/sse";

type Context = { params: Promise<{ id: string }> };

function canCancelOrder(orderDate: Date) {
  const now = new Date();
  const deadline = new Date(orderDate.getTime() - 24 * 60 * 60 * 1000);
  return now < deadline;
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { cancelToken?: string };
  const order = await db.order.findUnique({
    where: { id },
    select: { id: true, orderDate: true, cancelToken: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  if (!canCancelOrder(order.orderDate)) {
    return NextResponse.json(
      { error: "Sipariş teslimatına 24 saatten az kaldığı için iptal edilemez." },
      { status: 409 },
    );
  }

  if (!body.cancelToken || body.cancelToken !== order.cancelToken) {
    return NextResponse.json({ error: "Sipariş iptal doğrulaması başarısız." }, { status: 401 });
  }

  await db.order.delete({ where: { id } });
  void publishSse({ type: "order.deleted", orderId: id, ts: Date.now() });
  return NextResponse.json({ ok: true });
}
