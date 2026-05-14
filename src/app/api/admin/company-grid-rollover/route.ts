import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { runCompanyGridDayClose } from "@/lib/company-grid-close";

export const dynamic = "force-dynamic";

/** Kaçırılmış öğle kapanışlarını idempotent tamamlar (admin İşletmeler sayfası açılışında). */
export async function POST() {
  const denied = await ensureAdmin();
  if (denied) return denied;
  try {
    const result = await runCompanyGridDayClose(new Date());
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Arşiv çalıştırılamadı." }, { status: 500 });
  }
}
