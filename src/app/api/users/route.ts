import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const users = await db.user.findMany({
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  try {
    const body = await request.json();
    const { email, password, name, role, companyName } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "E-posta, şifre ve isim zorunludur." }, { status: 400 });
    }

    const allowedRole = role === "ADMIN" ? "ADMIN" : "CUSTOMER";

    const hashedPassword = await bcrypt.hash(password, 10);

    let companyId = null;
    if (allowedRole === "CUSTOMER" && companyName) {
      const company = await db.company.upsert({
        where: { name: companyName },
        update: {},
        create: { name: companyName },
      });
      companyId = company.id;
    }

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: allowedRole,
        companyId,
      },
    });

    return NextResponse.json(user);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor." }, { status: 400 });
    }
    return NextResponse.json({ error: "Kullanıcı oluşturulamadı." }, { status: 500 });
  }
}
