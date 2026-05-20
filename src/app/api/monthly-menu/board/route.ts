import { NextResponse } from "next/server";
import { ensureCustomerOrAdmin } from "@/lib/api-auth";
import { readMonthlyMenuGrid } from "@/lib/monthly-menu-board";
import { downloadMenuFile, resolveMenuForRequest, resolveYearMonthParam } from "@/lib/monthly-menu-server";
import { isSupabaseStorageConfigured } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const denied = await ensureCustomerOrAdmin();
  if (denied) return denied;

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ error: "Storage yapılandırılmadı" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const requestedYearMonth = resolveYearMonthParam(searchParams.get("yearMonth"));
  const active = await resolveMenuForRequest(requestedYearMonth);
  if (!active) {
    return NextResponse.json({ error: "Menü bulunamadı" }, { status: 404 });
  }

  if (active.kind === "pdf") {
    return NextResponse.json({
      kind: "pdf" as const,
      yearMonth: active.yearMonth,
      fileName: active.fileName,
      viewUrl: `/api/monthly-menu/file?yearMonth=${encodeURIComponent(active.yearMonth)}`,
    });
  }

  try {
    const blob = await downloadMenuFile(active.path);
    const buffer = await blob.arrayBuffer();
    const board = readMonthlyMenuGrid(buffer, active.yearMonth);
    return NextResponse.json({
      kind: "xlsx" as const,
      yearMonth: active.yearMonth,
      fileName: active.fileName,
      board,
    });
  } catch {
    return NextResponse.json({ error: "Menü okunamadı" }, { status: 500 });
  }
}
