import { NextResponse } from "next/server";
import { ensureCustomerOrAdmin } from "@/lib/api-auth";
import {
  buildMonthlyMenuFileResponse,
  getActiveMenuForMonth,
  resolveYearMonthParam,
} from "@/lib/monthly-menu-server";
import { isSupabaseStorageConfigured } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const denied = await ensureCustomerOrAdmin();
  if (denied) return denied;

  if (!isSupabaseStorageConfigured()) {
    return new NextResponse("Storage yapılandırılmadı", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const yearMonth = resolveYearMonthParam(searchParams.get("yearMonth"));
  const active = await getActiveMenuForMonth(yearMonth);
  if (!active) {
    return new NextResponse("Menü bulunamadı", { status: 404 });
  }

  try {
    const { body, contentType, fileName } = await buildMonthlyMenuFileResponse(active);
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Dosya alınamadı", { status: 500 });
  }
}
