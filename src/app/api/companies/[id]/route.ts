import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { normalizeToE164Tr } from "@/lib/phone-e164";
import { companyUpdateSchema } from "@/lib/validations";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = companyUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let whatsappPhoneE164: string | null | undefined;
  if (parsed.data.whatsappPhoneE164 !== undefined) {
    const raw = parsed.data.whatsappPhoneE164;
    if (raw === null || raw.trim() === "") {
      whatsappPhoneE164 = null;
    } else {
      const norm = normalizeToE164Tr(raw);
      if (!norm) {
        return NextResponse.json(
          { error: "WhatsApp numarası geçersiz. Örnek: +905551234567 veya 05551234567" },
          { status: 400 },
        );
      }
      whatsappPhoneE164 = norm;
    }
  }

  const updated = await db.company.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote } : {}),
      ...(whatsappPhoneE164 !== undefined ? { whatsappPhoneE164 } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: Context) {
  const unauthorized = await ensureAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;

  try {
    await db.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "Bu işletmeye bağlı kullanıcı veya sipariş bulunduğu için silinemedi." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "İşletme silinemedi." }, { status: 500 });
  }
}
