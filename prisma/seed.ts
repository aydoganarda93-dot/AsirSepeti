import { ItemCategory, OrderKind, PrismaClient, Shift } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SHIFTS: Shift[] = ["MORNING", "EVENING", "NIGHT"];

async function main() {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

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

  const demoPasswordHash = await bcrypt.hash("123456", 10);

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@asirsepeti.com").trim().toLowerCase();
  const adminPasswordPlain = process.env.ADMIN_PASSWORD ?? "123456";
  const adminPasswordHash = await bcrypt.hash(adminPasswordPlain, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminPasswordHash,
      name: "Sistem Yöneticisi",
      role: "ADMIN",
    },
    create: {
      email: adminEmail,
      password: adminPasswordHash,
      name: "Sistem Yöneticisi",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "mutfak@asirsepeti.com" },
    update: { role: "CUSTOMER", name: "Demo Kullanıcı" },
    create: {
      email: "mutfak@asirsepeti.com",
      password: demoPasswordHash,
      name: "Demo Kullanıcı",
      role: "CUSTOMER",
    },
  });

  const fordCompany = created.find((c) => c.name === "Ford Otosan");
  if (fordCompany) {
    await prisma.user.upsert({
      where: { email: "ford@asirsepeti.com" },
      update: {},
      create: {
        email: "ford@asirsepeti.com",
        password: demoPasswordHash,
        name: "Ford Satın Alma",
        role: "CUSTOMER",
        companyId: fordCompany.id,
      },
    });
  }

  const baseQuantities: Record<ItemCategory, number> = {
    KUMANYA: 5,
    OGLEN_YEMEGI: 40,
    EKMEK_ARASI: 12,
    DUZ_EKMEK: 0,
  };

  const dates = [addDays(startOfDay(new Date()), 2), addDays(startOfDay(new Date()), 3)];

  for (let i = 0; i < 2; i += 1) {
    const company = created[i];
    const itemData = SHIFTS.flatMap((shift) =>
      Object.entries(baseQuantities).map(([category, quantity]) => ({
        shift,
        category: category as ItemCategory,
        quantity:
          shift === "MORNING"
            ? quantity
            : shift === "EVENING"
              ? quantity + i * 3
              : Math.max(0, quantity - 2 + i),
      })),
    );
    const existing = await prisma.order.findFirst({
      where: {
        companyId: company.id,
        orderDate: dates[i],
        kind: OrderKind.STANDARD,
      },
    });
    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          contactName: "Satın Alma Yetkilisi",
          notes: i === 0 ? "Az tuzlu menü" : "Vejetaryen opsiyonu",
          items: {
            deleteMany: {},
            create: itemData,
          },
        },
      });
    } else {
      await prisma.order.create({
        data: {
          companyId: company.id,
          contactName: "Satın Alma Yetkilisi",
          orderDate: dates[i],
          notes: i === 0 ? "Az tuzlu menü" : "Vejetaryen opsiyonu",
          kind: OrderKind.STANDARD,
          items: {
            create: itemData,
          },
        },
      });
    }
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
