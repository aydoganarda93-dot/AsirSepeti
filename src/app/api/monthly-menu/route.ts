import { NextResponse } from "next/server";
import { ensureCustomerOrAdmin } from "@/lib/api-auth";
import { MONTHLY_MENU_SIGNED_TTL_SEC } from "@/lib/monthly-menu-constants";
import { createSignedMenuUrl, getActiveMenuForMonth, resolveYearMonthParam } from "@/lib/monthly-menu-server";
import { isSupabaseStorageConfigured } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const denied = await ensureCustomerOrAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const yearMonth = resolveYearMonthParam(searchParams.get("yearMonth"));

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ available: false, yearMonth, configured: false });
  }

  const active = await getActiveMenuForMonth(yearMonth);
  if (!active) {
    return NextResponse.json({ available: false, yearMonth });
  }

  try {
    const url = await createSignedMenuUrl(active.path);
    return NextResponse.json({
      available: true,
      yearMonth,
      url,
      fileName: active.fileName,
      updatedAt: active.updatedAt?.toISOString() ?? null,
      expiresIn: MONTHLY_MENU_SIGNED_TTL_SEC,
    });
  } catch {
    return NextResponse.json({ available: false, yearMonth });
  }
}
