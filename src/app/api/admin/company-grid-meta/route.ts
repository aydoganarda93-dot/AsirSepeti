import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { formatPeriodStartAsYmd, liveGridPeriodStart } from "@/lib/company-grid-period";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await ensureAdmin();
  if (denied) return denied;
  const now = new Date();
  const live = liveGridPeriodStart(now);
  return NextResponse.json({
    todayPeriodYmd: formatPeriodStartAsYmd(live),
    livePeriodStartIso: live.toISOString(),
  });
}
