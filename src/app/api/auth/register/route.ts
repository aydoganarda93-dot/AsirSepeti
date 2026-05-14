import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";

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
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor." }, { status: 400 });
    }

    return NextResponse.json({ error: "Kayıt işlemi tamamlanamadı." }, { status: 500 });
  }
}
