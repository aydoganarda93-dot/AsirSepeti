import { NextResponse } from "next/server";
import { runCompanyGridDayClose } from "@/lib/company-grid-close";

export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  try {
    const result = await runCompanyGridDayClose(new Date());
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Arşiv çalıştırılamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  try {
    const result = await runCompanyGridDayClose(new Date());
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Arşiv çalıştırılamadı." }, { status: 500 });
  }
}
