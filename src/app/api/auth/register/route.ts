import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validations";

/**
 * Kayıt politikası: açık — ancak kötüye kullanıma karşı çok katmanlı koruma.
 *
 * 1) IP başına saatlik 3 deneme (RateLimitLog, action="register").
 * 2) Cloudflare Turnstile (env varsa zorunlu). TURNSTILE_SECRET_KEY tanımlı
 *    değilse atlanır — geliştirme ve geri uyum için.
 * 3) Zod schema: trim, lowercase email, min/max uzunluklar.
 * 4) Prisma P2002 → kullanıcı dostu Türkçe mesaj.
 *
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY ile widget render edilir (src/app/kayit/page.tsx);
 * client widget'tan dönen token "turnstileToken" alanı olarak gelir.
 */

const REGISTER_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 3,
};

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function registerFailureMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = (error.meta?.target as string[] | undefined) ?? [];
      if (fields.some((f) => f.includes("email"))) {
        return "Bu e-posta adresi zaten kullanılıyor.";
      }
      if (fields.some((f) => f.includes("name"))) {
        return "Bu işletme adı zaten kayıtlı; farklı bir ad deneyin veya yöneticinize başvurun.";
      }
      return "Bu bilgilerle kayıt oluşturulamıyor (benzersizlik kuralı).";
    }
    if (error.code === "P1001" || error.code === "P1000") {
      return "Veritabanına bağlanılamadı. DATABASE_URL ve ağ ayarlarını kontrol edin.";
    }
    if (error.code === "P2022") {
      return "Veritabanı şeması güncel değil. prisma migrate deploy veya db push çalıştırın.";
    }
    if (error.code === "P2021" || error.code === "P2010") {
      return "Veritabanında gerekli tablo veya kolon eksik. Şemayı güncelleyin.";
    }
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Veritabanı bağlantısı kurulamadı. Ortam değişkenlerini kontrol edin.";
  }
  return "Kayıt işlemi tamamlanamadı.";
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }
  if (!token || token.trim().length === 0) {
    return { ok: false, reason: "Bot doğrulaması başarısız. Lütfen kutuyu işaretleyin." };
  }

  try {
    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token.trim(),
        remoteip: ip,
      }),
      // Edge function değil; Node fetch timeout için AbortController ekleyebiliriz, şimdilik yeterli.
    });
    const data = (await verifyResponse.json().catch(() => null)) as { success?: boolean } | null;
    if (!data?.success) {
      return { ok: false, reason: "Bot doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin." };
    }
    return { ok: true };
  } catch (error) {
    console.error("[api/auth/register] turnstile verify failed", error);
    return { ok: false, reason: "Bot doğrulaması yapılamadı. Bağlantınızı kontrol edip tekrar deneyin." };
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const rateLimit = await checkRateLimit(ip, "register", REGISTER_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Çok fazla kayıt denemesi yaptınız. Lütfen daha sonra tekrar deneyin.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const body = await request.json();

    const turnstileResult = await verifyTurnstile(typeof body?.turnstileToken === "string" ? body.turnstileToken : undefined, ip);
    if (!turnstileResult.ok) {
      return NextResponse.json({ error: turnstileResult.reason }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, companyName } = parsed.data;
    const hashedPassword = await bcrypt.hash(password, 10);

    const company = await db.company.upsert({
      where: { name: companyName },
      update: {},
      create: { name: companyName },
    });

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "CUSTOMER",
        companyId: company.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    console.error("[api/auth/register]", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const msg = registerFailureMessage(error);
      const status = msg.includes("e-posta") || msg.includes("işletme") ? 400 : 409;
      return NextResponse.json({ error: msg }, { status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const msg = registerFailureMessage(error);
      const status =
        msg.includes("Bağlan") || msg.includes("bağlantı") || msg.includes("şema") || msg.includes("tablo")
          ? 503
          : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ error: registerFailureMessage(error) }, { status: 503 });
    }

    return NextResponse.json({ error: registerFailureMessage(error) }, { status: 500 });
  }
}
