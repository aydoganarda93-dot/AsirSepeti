import { ItemCategory, PrismaClient } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const companies = [
    "Arçelik Fabrikası",
    "Ford Otosan",
    "Vestel Elektronik",
    "Tofaş Otomobil",
    "BSH Ev Aletleri",
  ];

  const created = await Promise.all(
    companies.map((name) =>
      prisma.company.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  const baseQuantities: Record<ItemCategory, number> = {
    OGLEN_YEMEGI: 45,
    KAPALI_KAP: 10,
    SEFERTASI: 8,
    SALATA: 20,
    KUMANYA: 5,
    TATLI: 15,
    EKMEK_ARASI: 12,
  };

  const dates = [addDays(startOfDay(new Date()), 2), addDays(startOfDay(new Date()), 3)];

  for (let i = 0; i < 2; i += 1) {
    const company = created[i];
    await prisma.order.upsert({
      where: {
        companyId_orderDate: {
          companyId: company.id,
          orderDate: dates[i],
        },
      },
      update: {
        contactName: "Satın Alma Yetkilisi",
        notes: i === 0 ? "Az tuzlu menü" : "Vejetaryen opsiyonu",
        items: {
          deleteMany: {},
          create: Object.entries(baseQuantities).map(([category, quantity]) => ({
            category: category as ItemCategory,
            quantity: quantity + i * 3,
          })),
        },
      },
      create: {
        companyId: company.id,
        contactName: "Satın Alma Yetkilisi",
        orderDate: dates[i],
        notes: i === 0 ? "Az tuzlu menü" : "Vejetaryen opsiyonu",
        items: {
          create: Object.entries(baseQuantities).map(([category, quantity]) => ({
            category: category as ItemCategory,
            quantity: quantity + i * 3,
          })),
        },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
