import { z } from "zod";
import { ALL_CATEGORIES } from "@/lib/categories";
import { parseDateOnlyUtc, startOfUtcCalendarDay } from "@/lib/date";

const quantitySchema = z.coerce.number().int().min(0).default(0);

export const categoryQuantitiesSchema = z.object({
  KUMANYA: quantitySchema,
  OGLEN_YEMEGI: quantitySchema,
  EKMEK_ARASI: quantitySchema,
  DUZ_EKMEK: quantitySchema,
});

export const shiftQuantitiesSchema = z
  .object({
    morning: categoryQuantitiesSchema,
    evening: categoryQuantitiesSchema,
    night: categoryQuantitiesSchema,
  })
  .refine(
    (value) =>
      [...ALL_CATEGORIES].some(
        (category) =>
          (value.morning[category] ?? 0) > 0 ||
          (value.evening[category] ?? 0) > 0 ||
          (value.night[category] ?? 0) > 0,
      ),
    "En az bir vardiyada en az bir kategori için adet 1 veya daha fazla olmalıdır.",
  );

const itemCategoryEnum = z.enum(["KUMANYA", "OGLEN_YEMEGI", "EKMEK_ARASI", "DUZ_EKMEK"]);
const itemStatusEnum = z.enum(["PENDING", "PREPARING", "READY"]);
const shiftEnum = z.enum(["MORNING", "EVENING", "NIGHT"]);

export const createOrderSchema = z
  .object({
    orderDate: z.string().date(),
    notes: z.string().max(2000).optional(),
    quantities: shiftQuantitiesSchema,
  });

/** API gövdesi: müşteri ek talep / yönetici firma seçimi */
export const createOrderBodySchema = createOrderSchema.extend({
  asSupplement: z.boolean().optional(),
  companyId: z.string().optional(),
  contactName: z.string().optional(),
});

/** Müşteri yalnızca bekleyen siparişte not ve miktar günceller */
export const customerOrderUpdateSchema = z.object({
  notes: z.string().max(2000).optional(),
  quantities: shiftQuantitiesSchema,
});

export const updateOrderSchema = z.object({
  contactName: z.string().min(2).max(120).optional(),
  notes: z.string().max(2000).optional().nullable(),
  quantities: shiftQuantitiesSchema.optional(),
  status: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"]).optional(),
});

export const statusUpdateSchema = z.object({
  orderStatus: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"]).optional(),
  itemStatus: itemStatusEnum.optional(),
  shift: shiftEnum.optional(),
  itemCategory: itemCategoryEnum.optional(),
});

export const companyCreateSchema = z.object({
  name: z.string().min(2).max(120),
});

export const companyUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  adminNote: z.string().max(3000).nullable(),
  /** Boş veya null = kaldır; ham metin gönderilir, sunucu +90 E.164 normalize eder */
  whatsappPhoneE164: z.union([z.string().max(40), z.null()]).optional(),
});

export const inboundPromoteSchema = z.object({
  orderDate: z.string().date(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(6).max(128),
  companyName: z.string().trim().min(2).max(120),
});

const MAX_ORDER_LEAD_DAYS_UTC = 365;

export function assertOrderDateWindow(orderDateRaw: string): Date {
  const candidate = parseDateOnlyUtc(orderDateRaw);
  const now = new Date();
  const todayUtc = startOfUtcCalendarDay(0, now);
  const maxUtc = startOfUtcCalendarDay(MAX_ORDER_LEAD_DAYS_UTC, now);

  if (!candidate || candidate < todayUtc) {
    throw new Error("Sipariş tarihi bugün veya sonrası olmalıdır.");
  }
  if (candidate > maxUtc) {
    throw new Error("Sipariş tarihi en fazla bir yıl ilerisini seçebilirsiniz.");
  }

  return candidate;
}
