import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyCreateSchema } from "@/lib/validations";

export async function GET() {
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = companyCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const company = await db.company.create({
    data: { name: parsed.data.name },
  });

  return NextResponse.json(company, { status: 201 });
}
