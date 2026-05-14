import { ItemCategory } from "@prisma/client";

export const ALL_CATEGORIES: ItemCategory[] = [
  ItemCategory.OGLEN_YEMEGI,
  ItemCategory.EKMEK_ARASI,
  ItemCategory.KUMANYA,
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  KUMANYA: "Kumanya",
  OGLEN_YEMEGI: "Yemek",
  EKMEK_ARASI: "Ekmek Arası",
};

export const SHIFT_LABELS = {
  MORNING: "Sabah",
  EVENING: "Akşam",
  NIGHT: "Gece",
} as const;
