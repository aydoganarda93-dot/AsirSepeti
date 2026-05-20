import { ItemCategory, OrderKind, OrderStatus, Prisma, Shift } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_CATEGORIES } from "@/lib/categories";
import { computeGridDeltasFromOrderItems, mergeCompanyAdminNoteWithDeltas } from "@/lib/company-admin-grid";
import { createOrderActivity, ORDER_ACTIVITY_TYPES } from "@/lib/order-activity";
import { parseDateOnlyUtc } from "@/lib/date";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { publishSse } from "@/lib/sse";
import { assertOrderDateWindow, createOrderBodySchema } from "@/lib/validations";

type ShiftPayload = {
  morning: Record<ItemCategory, number>;
  evening: Record<ItemCategory, number>;
  night: Record<ItemCategory, number>;
};

const CREATE_ORDER_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 20,
};

function hasGridDeltas(deltas: ReturnType<typeof computeGridDeltasFromOrderItems>): boolean {
  return (
    deltas.kumanya > 0 ||
    deltas.oglen > 0 ||
    deltas.aksam > 0 ||
    deltas.oglenEkmek > 0 ||
    deltas.aksamEkmek > 0
  );
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
    const rateLimit = await checkRateLimit(ip, "create-order", CREATE_ORDER_RATE_LIMIT);
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
    let autoSupplement = false;

    if (isAdmin) {
      const itemRows = toItems(input.quantities);
      const manualResult = await db.$transaction(async (tx) => {
        let upsert = false;
        const existing = await tx.order.findFirst({
          where: {
            companyId: company.id,
            orderDate: validDate,
            kind: OrderKind.STANDARD,
          },
          include: { items: true, company: true },
        });

        if (existing) {
          upsert = true;
          const prevDeltas = computeGridDeltasFromOrderItems(existing.items);
          if (existing.gridAppliedAt && hasGridDeltas(prevDeltas)) {
            const revertedNote = mergeCompanyAdminNoteWithDeltas(existing.company.adminNote, prevDeltas, -1);
            await tx.company.update({
              where: { id: company.id },
              data: { adminNote: revertedNote },
            });
          }

          await tx.order.update({
            where: { id: existing.id },
            data: {
              contactName,
              notes: input.notes,
              status: OrderStatus.CONFIRMED,
              items: { deleteMany: {}, create: itemRows },
            },
          });
        } else {
          try {
            await tx.order.create({
              data: {
                companyId: company.id,
                contactName,
                orderDate: validDate,
                notes: input.notes,
                kind: OrderKind.STANDARD,
                status: OrderStatus.CONFIRMED,
                items: { create: itemRows },
              },
            });
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              const raced = await tx.order.findFirst({
                where: {
                  companyId: company.id,
                  orderDate: validDate,
                  kind: OrderKind.STANDARD,
                },
                include: { items: true, company: true },
              });
              if (!raced) throw err;
              upsert = true;
              const prevDeltas = computeGridDeltasFromOrderItems(raced.items);
              if (raced.gridAppliedAt && hasGridDeltas(prevDeltas)) {
                const revertedNote = mergeCompanyAdminNoteWithDeltas(raced.company.adminNote, prevDeltas, -1);
                await tx.company.update({
                  where: { id: company.id },
                  data: { adminNote: revertedNote },
                });
              }
              await tx.order.update({
                where: { id: raced.id },
                data: {
                  contactName,
                  notes: input.notes,
                  status: OrderStatus.CONFIRMED,
                  items: { deleteMany: {}, create: itemRows },
                },
              });
            } else {
              throw err;
            }
          }
        }

        const saved = await tx.order.findFirst({
          where: {
            companyId: company.id,
            orderDate: validDate,
            kind: OrderKind.STANDARD,
          },
          include: { items: true, company: true },
        });
        if (!saved) {
          throw new Error("Manuel sipariş kaydedilemedi.");
        }

        const newDeltas = computeGridDeltasFromOrderItems(saved.items);
        if (hasGridDeltas(newDeltas)) {
          const nextNote = mergeCompanyAdminNoteWithDeltas(saved.company.adminNote, newDeltas, 1);
          await tx.company.update({
            where: { id: company.id },
            data: { adminNote: nextNote },
          });
          await tx.order.update({
            where: { id: saved.id },
            data: { gridAppliedAt: new Date() },
          });
        }

        const final = await tx.order.findUnique({
          where: { id: saved.id },
          include: { company: true, items: true },
        });
        if (!final) {
          throw new Error("Manuel sipariş kaydedilemedi.");
        }

        return { order: final, upsert };
      });

      order = manualResult.order;
      adminManualUpsert = manualResult.upsert;
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
        autoSupplement = true;
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
        try {
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
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            autoSupplement = true;
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
            throw err;
          }
        }
      }
    }
    await db.orderActivity.create({
      data: {
        orderId: order.id,
        type: isAdmin
          ? adminManualUpsert
            ? ORDER_ACTIVITY_TYPES.ADMIN_MANUAL_UPSERT
            : ORDER_ACTIVITY_TYPES.ORDER_CREATED
          : ORDER_ACTIVITY_TYPES.ORDER_CREATED,
        meta: { kind: order.kind, ...(autoSupplement ? { autoSupplement: true } : {}) },
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
