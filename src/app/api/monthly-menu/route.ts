import { NextResponse } from "next/server";
import { ensureCustomerOrAdmin } from "@/lib/api-auth";
import { MONTHLY_MENU_SIGNED_TTL_SEC } from "@/lib/monthly-menu-constants";
import {
  createSignedMenuUrl,
  resolveMenuForRequest,
  resolveYearMonthParam,
} from "@/lib/monthly-menu-server";
import { isSupabaseStorageConfigured } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const denied = await ensureCustomerOrAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const requestedYearMonth = resolveYearMonthParam(searchParams.get("yearMonth"));

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ available: false, requestedYearMonth, configured: false });
  }

  const active = await resolveMenuForRequest(requestedYearMonth);
  if (!active) {
    return NextResponse.json({ available: false, requestedYearMonth });
  }

  try {
    const url = await createSignedMenuUrl(active.path);
    return NextResponse.json({
      available: true,
      yearMonth: active.yearMonth,
      requestedYearMonth,
      url,
      fileName: active.fileName,
      kind: active.kind,
      updatedAt: active.updatedAt?.toISOString() ?? null,
      expiresIn: MONTHLY_MENU_SIGNED_TTL_SEC,
    });
  } catch {
    return NextResponse.json({ available: false, requestedYearMonth });
  }
}
