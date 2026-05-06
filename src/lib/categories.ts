import { ItemCategory } from "@prisma/client";

export const ALL_CATEGORIES: ItemCategory[] = [
  ItemCategory.OGLEN_YEMEGI,
  ItemCategory.KAPALI_KAP,
  ItemCategory.SEFERTASI,
  ItemCategory.SALATA,
  ItemCategory.KUMANYA,
  ItemCategory.TATLI,
  ItemCategory.EKMEK_ARASI,
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  OGLEN_YEMEGI: "Öğlen Yemeği",
  KAPALI_KAP: "Kapalı Kap",
  SEFERTASI: "Sefertası",
  SALATA: "Salata",
  KUMANYA: "Kumanya",
  TATLI: "Tatlı",
  EKMEK_ARASI: "Ekmek Arası",
};
