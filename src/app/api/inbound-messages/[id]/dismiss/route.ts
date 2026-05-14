import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  const row = await db.inboundMessage.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  }
  if (row.status === "ORDER_CREATED") {
    return NextResponse.json({ error: "Sipariş oluşturulmuş kayıt reddedilemez." }, { status: 400 });
  }

  await db.inboundMessage.update({
    where: { id },
    data: { status: "DISMISSED" },
  });

  return NextResponse.json({ ok: true });
}
