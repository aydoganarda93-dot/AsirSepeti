import { NextResponse } from "next/server";
import { ensureCustomerOrAdmin } from "@/lib/api-auth";
import { downloadMenuPdf, getActiveMenuForMonth, resolveYearMonthParam } from "@/lib/monthly-menu-server";
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
    const blob = await downloadMenuPdf(active.path);
    const arrayBuffer = await blob.arrayBuffer();
    const safeName = (active.fileName ?? "menu.pdf").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("PDF alınamadı", { status: 500 });
  }
}
