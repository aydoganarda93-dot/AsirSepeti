import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { promoteInboundMessageToOrder } from "@/lib/inbound-promote";
import { inboundPromoteSchema } from "@/lib/validations";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = inboundPromoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const order = await promoteInboundMessageToOrder(id, parsed.data.orderDate);
    return NextResponse.json({ ok: true, order });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sipariş oluşturulamadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
