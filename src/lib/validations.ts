import { ItemCategory, ItemStatus, OrderStatus } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import { z } from "zod";
import { ALL_CATEGORIES } from "@/lib/categories";

const quantitySchema = z.coerce.number().int().min(0).default(0);

export const categoryQuantitiesSchema = z
  .object({
    OGLEN_YEMEGI: quantitySchema,
    KAPALI_KAP: quantitySchema,
    SEFERTASI: quantitySchema,
    SALATA: quantitySchema,
    KUMANYA: quantitySchema,
    TATLI: quantitySchema,
    EKMEK_ARASI: quantitySchema,
  })
  .refine(
    (value) => ALL_CATEGORIES.some((category) => (value[category] ?? 0) > 0),
    "En az bir kategoride adet 1 veya daha fazla olmalıdır.",
  );

export const createOrderSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    companyName: z.string().min(2).max(120).optional(),
    contactName: z.string().min(2).max(120),
    orderDate: z.string().date(),
    notes: z.string().max(2000).optional(),
    quantities: categoryQuantitiesSchema,
  })
  .refine((value) => Boolean(value.companyId || value.companyName), {
    message: "Firma seçimi veya firma adı zorunludur.",
    path: ["companyName"],
  });

export const updateOrderSchema = z.object({
  contactName: z.string().min(2).max(120).optional(),
  notes: z.string().max(2000).optional().nullable(),
  quantities: categoryQuantitiesSchema.optional(),
  status: z.nativeEnum(OrderStatus).optional(),
});

export const statusUpdateSchema = z.object({
  orderStatus: z.nativeEnum(OrderStatus).optional(),
  itemStatus: z.nativeEnum(ItemStatus).optional(),
  itemCategory: z.nativeEnum(ItemCategory).optional(),
});

export const companyCreateSchema = z.object({
  name: z.string().min(2).max(120),
});

export function assertOrderDateWindow(orderDateRaw: string): Date {
  const parsed = new Date(orderDateRaw);
  const minDate = addDays(startOfDay(new Date()), 2);
  const candidate = startOfDay(parsed);

  if (Number.isNaN(candidate.getTime()) || candidate < minDate) {
    throw new Error("Sipariş tarihi bugünden en az 2 gün sonrası olmalıdır.");
  }

  return candidate;
}
