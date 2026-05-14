import { ItemCategory, OrderKind, Shift } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_CATEGORIES } from "@/lib/categories";
import { ORDER_ACTIVITY_TYPES } from "@/lib/order-activity";
import { parseDateOnlyUtc } from "@/lib/date";
import { publishSse } from "@/lib/sse";
import { assertOrderDateWindow, createOrderBodySchema } from "@/lib/validations";

type ShiftPayload = {
  morning: Record<ItemCategory, number>;
  evening: Record<ItemCategory, number>;
  night: Record<ItemCategory, number>;
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 saat
const RATE_LIMIT_MAX_REQUESTS = 5;

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function checkRateLimit(ip: string) {
  const now = Date.now();
  const windowStartDate = new Date(now - RATE_LIMIT_WINDOW_MS);
  const recent = await db.rateLimitLog.findMany({
    where: {
      ip,
      action: "create-order",
      createdAt: { gt: windowStartDate },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestInWindow = recent[0]?.createdAt.getTime() ?? now;
    const retryAfterMs = Math.max(0, oldestInWindow + RATE_LIMIT_WINDOW_MS - now);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  await db.rateLimitLog.create({
    data: {
      ip,
      action: "create-order",
    },
  });

  void db.rateLimitLog.deleteMany({
    where: {
      createdAt: { lt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return { allowed: true, retryAfterSeconds: 0 };
}

function toItems(quantities: ShiftPayload) {
  const shifts: Array<{ key: keyof ShiftPayload; shift: Shift }> = [
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

export async function GET(request: Request) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const companyId = searchParams.get("companyId");
  const hasNotes = searchParams.get("hasNotes");
  const category = searchParams.get("category");
  const includeActivities = searchParams.get("includeActivities") === "true";

  if (!date && !startDate && !endDate) {
    return NextResponse.json({ error: "Tarih veya tarih aralığı zorunludur." }, { status: 400 });
  }

  const target = date ? parseDateOnlyUtc(date) : null;
  if (date && !target) {
    return NextResponse.json({ error: "Geçersiz tarih formatı." }, { status: 400 });
  }

  const parsedStartDate = startDate ? parseDateOnlyUtc(startDate) : null;
  const parsedEndDate = endDate ? parseDateOnlyUtc(endDate) : null;

  if (startDate && !parsedStartDate) {
    return NextResponse.json({ error: "Geçersiz başlangıç tarihi formatı." }, { status: 400 });
  }
  if (endDate && !parsedEndDate) {
    return NextResponse.json({ error: "Geçersiz bitiş tarihi formatı." }, { status: 400 });
  }
  if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıç tarihinden küçük olamaz." }, { status: 400 });
  }
  const orders = await db.order.findMany({
    where: {
      orderDate: target
        ? target
        : {
            gte: parsedStartDate ?? undefined,
            lte: parsedEndDate ?? undefined,
          },
      companyId: companyId ?? undefined,
      notes: hasNotes === "true" ? { not: null } : undefined,
      items: category ? { some: { category: category as ItemCategory } } : undefined,
    },
    include: {
      company: true,
      items: true,
      ...(includeActivities ? { activities: { orderBy: { createdAt: "asc" as const } } } : {}),
    },
    /** En son oluşturulan siparişler üstte */
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz işlem. Giriş yapın." }, { status: 401 });
    }
    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && !session.user.companyId) {
      return NextResponse.json({ error: "Yetkisiz işlem. Şirket hesabı ile giriş yapın." }, { status: 401 });
    }

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Çok fazla sipariş denemesi yaptınız. Lütfen daha sonra tekrar deneyin.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();
    const parsed = createOrderBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const validDate = assertOrderDateWindow(parsed.data.orderDate);
    const input = {
      orderDate: parsed.data.orderDate,
      notes: parsed.data.notes,
      quantities: parsed.data.quantities,
    };
    const asSupplement = parsed.data.asSupplement === true;

    let companyId = session.user.companyId;
    let contactName = session.user.name || "Kullanıcı";

    if (session.user.role === "ADMIN") {
      if (!body.companyId) {
        return NextResponse.json({ error: "Yönetici olarak sipariş girerken firma seçmelisiniz." }, { status: 400 });
      }
      companyId = body.companyId;
      contactName = body.contactName || "Yönetici";
    }

    if (!companyId) {
      return NextResponse.json({ error: "Geçerli bir firma bulunamadı." }, { status: 400 });
    }

    const company = await db.company.findUnique({ where: { id: companyId } });

    if (!company) {
      return NextResponse.json({ error: "Kayıtlı olduğunuz firma bulunamadı." }, { status: 404 });
    }

    let order;
    let adminManualUpsert = false;

    if (isAdmin) {
      const existing = await db.order.findFirst({
        where: {
          companyId: company.id,
          orderDate: validDate,
          kind: OrderKind.STANDARD,
        },
      });
      if (existing) {
        adminManualUpsert = true;
        order = await db.order.update({
          where: { id: existing.id },
          data: {
            contactName,
            notes: input.notes,
            items: {
              deleteMany: {},
              create: toItems(input.quantities),
            },
          },
          include: { company: true, items: true },
        });
      } else {
        order = await db.order.create({
          data: {
            companyId: company.id,
            contactName,
            orderDate: validDate,
            notes: input.notes,
            kind: OrderKind.STANDARD,
            items: {
              create: toItems(input.quantities),
            },
          },
          include: { company: true, items: true },
        });
      }
    } else if (asSupplement) {
      order = await db.order.create({
        data: {
          companyId: company.id,
          contactName,
          orderDate: validDate,
          notes: input.notes,
          kind: OrderKind.SUPPLEMENT,
          items: {
            create: toItems(input.quantities),
          },
        },
        include: { company: true, items: true },
      });
    } else {
      const existingStandard = await db.order.findFirst({
        where: {
          companyId: company.id,
          orderDate: validDate,
          kind: OrderKind.STANDARD,
        },
      });

      if (existingStandard) {
        if (existingStandard.status === "PENDING") {
          return NextResponse.json(
            {
              error:
                "Bu güne zaten sipariş göndermişsiniz; önce «Siparişlerim»den düzeltin veya «Üzerine ekle» kullanın.",
              code: "PENDING_STANDARD_EXISTS",
              existingOrderId: existingStandard.id,
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            error:
              "Bu güne ait siparişiniz işleme alındı. Ek adet için «Üzerine ekle»ye basın.",
            code: "STANDARD_LOCKED",
          },
          { status: 409 },
        );
      }

      order = await db.order.create({
        data: {
          companyId: company.id,
          contactName,
          orderDate: validDate,
          notes: input.notes,
          kind: OrderKind.STANDARD,
          items: {
            create: toItems(input.quantities),
          },
        },
        include: { company: true, items: true },
      });
    }
    await db.orderActivity.create({
      data: {
        orderId: order.id,
        type: isAdmin
          ? adminManualUpsert
            ? ORDER_ACTIVITY_TYPES.ADMIN_MANUAL_UPSERT
            : ORDER_ACTIVITY_TYPES.ORDER_CREATED
          : ORDER_ACTIVITY_TYPES.ORDER_CREATED,
        meta: { kind: order.kind },
      },
    });

    void publishSse({ type: "order.changed", orderId: order.id, ts: Date.now() });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Sipariş tarihi")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("Can't reach database server") || error.message.includes("P1001"))
    ) {
      return NextResponse.json(
        { error: "Sipariş kaydedilemedi. Veritabanı bağlantısı kurulamadı." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Sipariş işlenirken beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
