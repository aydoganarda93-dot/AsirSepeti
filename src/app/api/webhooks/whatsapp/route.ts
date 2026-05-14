import { InboundMessageStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { formatUtcYmdFromOffset } from "@/lib/date";
import { db } from "@/lib/db";
import { extractInboundPayload } from "@/lib/inbound-payload";
import { promoteInboundMessageToOrder } from "@/lib/inbound-promote";
import { normalizeToE164Tr } from "@/lib/phone-e164";
import { parseQuickOrderText } from "@/lib/parse-quick-order-text";

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 120;

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function checkWebhookRate(ip: string) {
  const now = Date.now();
  const windowStartDate = new Date(now - RATE_WINDOW_MS);
  const recent = await db.rateLimitLog.findMany({
    where: {
      ip,
      action: "webhook-whatsapp",
      createdAt: { gt: windowStartDate },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (recent.length >= RATE_MAX) {
    const oldestInWindow = recent[0]?.createdAt.getTime() ?? now;
    const retryAfterMs = Math.max(0, oldestInWindow + RATE_WINDOW_MS - now);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  await db.rateLimitLog.create({
    data: {
      ip,
      action: "webhook-whatsapp",
    },
  });

  void db.rateLimitLog.deleteMany({
    where: {
      createdAt: { lt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return { allowed: true, retryAfterSeconds: 0 };
}

function verifyInboundSecret(request: Request): NextResponse | null {
  const secret = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook yapılandırılmadı." }, { status: 503 });
  }

  const header =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-inbound-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  const qs = new URL(request.url).searchParams.get("secret") ?? "";

  const token = header || qs;
  if (token !== secret) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const denied = verifyInboundSecret(request);
  if (denied) return denied;

  const ip = getClientIp(request);
  const rate = await checkWebhookRate(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek.", retryAfterSeconds: rate.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let extracted;
  try {
    extracted = await extractInboundPayload(request);
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde." }, { status: 400 });
  }

  if (!extracted) {
    return NextResponse.json({ error: "From / gönderen bulunamadı." }, { status: 400 });
  }

  if (extracted.externalId) {
    const dup = await db.inboundMessage.findUnique({
      where: { externalId: extracted.externalId },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const fromNorm = normalizeToE164Tr(extracted.fromRaw);
  const fromPhoneNorm = fromNorm ?? extracted.fromRaw.replace(/\s+/g, "").slice(0, 32);

  const toNorm = extracted.toRaw ? normalizeToE164Tr(extracted.toRaw) : null;
  const company =
    toNorm ?
      await db.company.findFirst({
        where: { whatsappPhoneE164: toNorm },
        select: { id: true },
      })
    : null;

  const parsed = parseQuickOrderText(extracted.body);

  let status: InboundMessageStatus;
  if (!company) {
    status = "NO_COMPANY";
  } else if (parsed.appliedTokens === 0) {
    status = "PARSE_EMPTY";
  } else {
    status = "PENDING_REVIEW";
  }

  const created = await db.inboundMessage.create({
    data: {
      provider: "twilio",
      externalId: extracted.externalId ?? undefined,
      fromPhoneNorm,
      rawBody: extracted.body,
      companyId: company?.id,
      status,
      parseAppliedTokens: parsed.appliedTokens,
    },
  });

  const auto =
    process.env.WHATSAPP_AUTO_CREATE_ORDER === "true" &&
    company &&
    parsed.appliedTokens > 0 &&
    status === "PENDING_REVIEW";

  if (auto) {
    try {
      await promoteInboundMessageToOrder(created.id, formatUtcYmdFromOffset(1));
    } catch {
      /* Manuel kuyrukta kalır */
    }
  }

  return NextResponse.json({ ok: true, id: created.id });
}
