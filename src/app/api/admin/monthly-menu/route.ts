import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { formatUtcYmdFromOffset } from "@/lib/date";
import {
  contentTypeForMenuKind,
  MONTHLY_MENU_BUCKET,
  MONTHLY_MENU_SIGNED_TTL_SEC,
  validateMonthlyMenuFile,
} from "@/lib/monthly-menu-constants";
import { createSignedMenuUrl, getSettingsRow } from "@/lib/monthly-menu-server";
import { getSupabaseAdmin, isSupabaseStorageConfigured } from "@/lib/supabase-admin";

export async function GET() {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const settings = await getSettingsRow();
  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ configured: false, settings, previewUrl: null });
  }

  let previewUrl: string | null = null;
  if (settings?.monthlyMenuStoragePath) {
    try {
      previewUrl = await createSignedMenuUrl(settings.monthlyMenuStoragePath);
    } catch {
      previewUrl = null;
    }
  }

  return NextResponse.json({
    configured: true,
    settings,
    previewUrl,
    expiresIn: MONTHLY_MENU_SIGNED_TTL_SEC,
  });
}

export async function POST(request: Request) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  if (!isSupabaseStorageConfigured()) {
    return NextResponse.json({ error: "Supabase Storage yapılandırılmadı." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya gerekli (alan adı: file)." }, { status: 400 });
  }

  const rawYm = formData.get("yearMonth");
  const yearMonth =
    typeof rawYm === "string" && /^\d{4}-\d{2}$/.test(rawYm)
      ? rawYm
      : formatUtcYmdFromOffset(0).slice(0, 7);

  const buf = Buffer.from(await file.arrayBuffer());
  const validated = validateMonthlyMenuFile(file, buf);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { kind } = validated;

  const supabase = getSupabaseAdmin();
  const prev = await db.appSettings.findUnique({ where: { id: 1 } });
  if (prev?.monthlyMenuStoragePath) {
    await supabase.storage.from(MONTHLY_MENU_BUCKET).remove([prev.monthlyMenuStoragePath]);
  }

  const ext = kind === "pdf" ? "pdf" : "xlsx";
  const objectPath = `${yearMonth}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(MONTHLY_MENU_BUCKET).upload(objectPath, buf, {
    contentType: contentTypeForMenuKind(kind),
    upsert: false,
  });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const updated = await db.appSettings.update({
    where: { id: 1 },
    data: {
      monthlyMenuStoragePath: objectPath,
      monthlyMenuFileName: file.name,
      monthlyMenuYearMonth: yearMonth,
      monthlyMenuUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, settings: updated });
}

export async function DELETE() {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const prev = await db.appSettings.findUnique({ where: { id: 1 } });
  if (prev?.monthlyMenuStoragePath && isSupabaseStorageConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.storage.from(MONTHLY_MENU_BUCKET).remove([prev.monthlyMenuStoragePath]);
    } catch {
      // DB yine de temizlenir
    }
  }

  await db.appSettings.update({
    where: { id: 1 },
    data: {
      monthlyMenuStoragePath: null,
      monthlyMenuFileName: null,
      monthlyMenuYearMonth: null,
      monthlyMenuUpdatedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
