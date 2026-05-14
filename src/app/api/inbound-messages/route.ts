import { InboundMessageStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const take = Math.min(100, Math.max(5, Number(searchParams.get("limit") ?? "40")));

  const allowed: InboundMessageStatus[] = [
    "PENDING_REVIEW",
    "ORDER_CREATED",
    "DISMISSED",
    "NO_COMPANY",
    "PARSE_EMPTY",
  ];

  const statusFilter =
    statusParam && allowed.includes(statusParam as InboundMessageStatus) ?
      (statusParam as InboundMessageStatus)
    : undefined;

  const rows = await db.inboundMessage.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      company: { select: { id: true, name: true } },
      order: { select: { id: true, orderDate: true, cancelToken: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(rows);
}
