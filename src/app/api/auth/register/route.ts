import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";

function registerFailureMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = (error.meta?.target as string[] | undefined) ?? [];
      if (fields.some((f) => f.includes("email"))) {
        return "Bu e-posta adresi zaten kullanılıyor.";
      }
      if (fields.some((f) => f.includes("name"))) {
        return "Bu işletme adı zaten kayıtlı; farklı bir ad deneyin veya yöneticinize başvurun.";
      }
      return "Bu bilgilerle kayıt oluşturulamıyor (benzersizlik kuralı).";
    }
    if (error.code === "P1001" || error.code === "P1000") {
      return "Veritabanına bağlanılamadı. DATABASE_URL ve ağ ayarlarını kontrol edin.";
    }
    if (error.code === "P2022") {
      return "Veritabanı şeması güncel değil. prisma migrate deploy veya db push çalıştırın.";
    }
    if (error.code === "P2021" || error.code === "P2010") {
      return "Veritabanında gerekli tablo veya kolon eksik. Şemayı güncelleyin.";
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Veritabanı bağlantısı kurulamadı. Ortam değişkenlerini kontrol edin.";
  }
  return "Kayıt işlemi tamamlanamadı.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, companyName } = parsed.data;
    const hashedPassword = await bcrypt.hash(password, 10);

    const company = await db.company.upsert({
      where: { name: companyName },
      update: {},
      create: { name: companyName },
    });

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "CUSTOMER",
        companyId: company.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    console.error("[api/auth/register]", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const msg = registerFailureMessage(error);
      const status = msg.includes("e-posta") || msg.includes("işletme") ? 400 : 409;
      return NextResponse.json({ error: msg }, { status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const msg = registerFailureMessage(error);
      const status =
        msg.includes("Bağlan") || msg.includes("bağlantı") || msg.includes("şema") || msg.includes("tablo")
          ? 503
          : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ error: registerFailureMessage(error) }, { status: 503 });
    }

    return NextResponse.json({ error: registerFailureMessage(error) }, { status: 500 });
  }
}
