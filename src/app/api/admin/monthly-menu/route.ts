import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { formatUtcYmdFromOffset } from "@/lib/date";
import { MONTHLY_MENU_BUCKET, MONTHLY_MENU_MAX_BYTES, MONTHLY_MENU_SIGNED_TTL_SEC } from "@/lib/monthly-menu-constants";
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
    return NextResponse.json({ error: "PDF dosyası gerekli (alan adı: file)." }, { status: 400 });
  }

  const rawYm = formData.get("yearMonth");
  const yearMonth =
    typeof rawYm === "string" && /^\d{4}-\d{2}$/.test(rawYm)
      ? rawYm
      : formatUtcYmdFromOffset(0).slice(0, 7);

  const lower = file.name.toLowerCase();
  const mimeOk =
    file.type === "application/pdf" || file.type === "" || file.type === "application/x-pdf";
  if (!mimeOk && !lower.endsWith(".pdf")) {
    return NextResponse.json({ error: "Yalnızca PDF kabul edilir." }, { status: 400 });
  }
  if (!lower.endsWith(".pdf")) {
    return NextResponse.json({ error: "Dosya adı .pdf ile bitmeli." }, { status: 400 });
  }
  if (file.size > MONTHLY_MENU_MAX_BYTES) {
    return NextResponse.json(
      { error: `Dosya çok büyük (en fazla ${MONTHLY_MENU_MAX_BYTES / 1024 / 1024} MB).` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 5 || buf.subarray(0, 5).toString() !== "%PDF-") {
    return NextResponse.json({ error: "Geçerli bir PDF dosyası yükleyin." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const prev = await db.appSettings.findUnique({ where: { id: 1 } });
  if (prev?.monthlyMenuStoragePath) {
    await supabase.storage.from(MONTHLY_MENU_BUCKET).remove([prev.monthlyMenuStoragePath]);
  }

  const objectPath = `${yearMonth}/${randomUUID()}.pdf`;
  const { error: upErr } = await supabase.storage.from(MONTHLY_MENU_BUCKET).upload(objectPath, buf, {
    contentType: "application/pdf",
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
