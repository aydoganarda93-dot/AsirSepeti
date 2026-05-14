import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { companyCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    // Public is intentional: sipariş formundaki firma dropdown'ı bu endpointi kullanır.
    const companies = await db.company.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(companies);
  } catch {
    return NextResponse.json(
      { error: "Firma listesi alınamadı. Veritabanı bağlantısını kontrol edin." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = companyCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let company;
  try {
    company = await db.company.create({
      data: { name: parsed.data.name },
    });
  } catch {
    return NextResponse.json(
      { error: "Firma kaydedilemedi. Veritabanı bağlantısını kontrol edin." },
      { status: 503 },
    );
  }

  return NextResponse.json(company, { status: 201 });
}
