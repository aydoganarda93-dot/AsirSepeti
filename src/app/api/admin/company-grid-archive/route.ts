import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { istanbulNoonFromYmd } from "@/lib/company-grid-period";
import type { CompanyGridPayload } from "@/lib/company-admin-grid";

export const dynamic = "force-dynamic";

/** `periodStart`: İstanbul yyyy-MM-dd (o gün 12:00 başlangıcı). */
export async function GET(request: Request) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const ymd = searchParams.get("periodStartYmd");
  if (!ymd) {
    return NextResponse.json({ error: "periodStartYmd zorunlu (yyyy-MM-dd)." }, { status: 400 });
  }
  const periodStart = istanbulNoonFromYmd(ymd);
  if (!periodStart) {
    return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
  }

  const rows = await db.companyGridDailyArchive.findMany({
    where: { periodStart },
    include: { company: { select: { id: true, name: true, whatsappPhoneE164: true } } },
  });

  const archives = rows.map((r) => ({
    companyId: r.companyId,
    companyName: r.company.name,
    whatsappPhoneE164: r.company.whatsappPhoneE164,
    payload: r.payload as CompanyGridPayload,
  }));

  return NextResponse.json({ periodStart: periodStart.toISOString(), periodStartYmd: ymd, archives });
}
