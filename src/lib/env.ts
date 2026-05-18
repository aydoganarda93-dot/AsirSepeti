/**
 * Çalışma anında env değişkenlerini kontrol eder.
 *
 * Yaklaşım: fail-fast yerine "uyar ve devam et" — kritik eksiklikler boot
 * sırasında konsola yüksek görünürlükle yazılır, ancak süreç düşmez. Bu sayede:
 *   - Eksik bir cron secret yüzünden tüm app crash etmez.
 *   - Vercel build/deploy log'unda eksiklik anında fark edilir.
 *   - Bazı env'ler yalnızca production'da zorunludur (NEXTAUTH_URL gibi).
 *
 * Kullanım: `src/instrumentation.ts` register() içinden bir kez çağrılır.
 */

type EnvKey =
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "NEXTAUTH_SECRET"
  | "NEXTAUTH_URL"
  | "ADMIN_EMAIL"
  | "ADMIN_PASSWORD"
  | "CRON_SECRET"
  | "INBOUND_WEBHOOK_SECRET"
  | "SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "TURNSTILE_SECRET_KEY"
  | "NEXT_PUBLIC_TURNSTILE_SITE_KEY";

type EnvCheck = {
  key: EnvKey;
  severity: "required" | "production-only" | "recommended";
  validate?: (value: string) => string | null;
  description: string;
};

const CHECKS: EnvCheck[] = [
  {
    key: "DATABASE_URL",
    severity: "required",
    description: "Prisma runtime bağlantısı (Supabase pooler, port 6543).",
  },
  {
    key: "DIRECT_URL",
    severity: "recommended",
    description: "Migration ve introspection için direct connection (port 5432).",
  },
  {
    key: "NEXTAUTH_SECRET",
    severity: "required",
    validate: (v) => (v.length < 16 ? "NEXTAUTH_SECRET en az 16 karakter olmalı." : null),
    description: "NextAuth JWT imzalama anahtarı (openssl rand -base64 32).",
  },
  {
    key: "NEXTAUTH_URL",
    severity: "production-only",
    validate: (v) => {
      if (!/^https?:\/\//i.test(v)) {
        return "NEXTAUTH_URL https:// veya http:// ile başlamalı (Vercel: https://...).";
      }
      if (v.endsWith("/")) {
        return "NEXTAUTH_URL sonunda / olmasın.";
      }
      return null;
    },
    description: "Production callback ve cookie domain'i için tam URL.",
  },
  {
    key: "ADMIN_EMAIL",
    severity: "required",
    description: "Seed komutu bu admin'i oluşturur / günceller.",
  },
  {
    key: "ADMIN_PASSWORD",
    severity: "required",
    validate: (v) => (v.length < 8 ? "ADMIN_PASSWORD en az 8 karakter olmalı." : null),
    description: "Admin hesabı parolası (seed sırasında bcrypt'lenir).",
  },
  {
    key: "CRON_SECRET",
    severity: "required",
    validate: (v) => (v.length < 16 ? "CRON_SECRET kısa; en az 16 karakter önerilir." : null),
    description: "Vercel cron → /api/cron/close-company-grid-day yetkilendirmesi.",
  },
  {
    key: "INBOUND_WEBHOOK_SECRET",
    severity: "required",
    validate: (v) => (v.length < 16 ? "INBOUND_WEBHOOK_SECRET kısa; en az 16 karakter önerilir." : null),
    description: "WhatsApp / SMS webhook (POST /api/webhooks/whatsapp) yetkilendirmesi.",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    severity: "recommended",
    description: "Aylık menü PDF imzalı URL üretimi için zorunlu (yoksa menü düğmesi gizlenir).",
  },
  {
    key: "TURNSTILE_SECRET_KEY",
    severity: "recommended",
    description: "Cloudflare Turnstile sunucu doğrulaması (kayıt formunda bot koruması). Yoksa Turnstile atlanır.",
  },
  {
    key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    severity: "recommended",
    description: "Turnstile widget site key'i (client). TURNSTILE_SECRET_KEY ile birlikte tanımlı olmalı.",
  },
];

const FALLBACKS: Partial<Record<EnvKey, EnvKey[]>> = {
  SUPABASE_URL: ["NEXT_PUBLIC_SUPABASE_URL"],
};

function readEnv(key: EnvKey): string | undefined {
  const raw = process.env[key];
  if (raw && raw.trim().length > 0) return raw.trim();
  const fallbacks = FALLBACKS[key];
  if (!fallbacks) return undefined;
  for (const alt of fallbacks) {
    const v = process.env[alt];
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function validateEnv(): void {
  const issues: string[] = [];

  for (const check of CHECKS) {
    const value = readEnv(check.key);

    if (!value) {
      const ignoreInDev = check.severity === "production-only" && !isProduction();
      if (ignoreInDev) continue;

      const tag = check.severity === "recommended" ? "ÖNERİLEN" : "EKSİK";
      issues.push(`[${tag}] ${check.key}: ${check.description}`);
      continue;
    }

    if (check.validate) {
      const validationError = check.validate(value);
      if (validationError) {
        issues.push(`[GEÇERSİZ] ${check.key}: ${validationError}`);
      }
    }
  }

  if (issues.length === 0) {
    console.log("[env] Tüm kontroller geçti.");
    return;
  }

  const header = isProduction()
    ? "[env] PRODUCTION ortamında ENV uyarıları:"
    : "[env] ENV uyarıları (development):";

  console.warn(`\n${"=".repeat(72)}\n${header}\n${"=".repeat(72)}`);
  for (const issue of issues) {
    console.warn(`  - ${issue}`);
  }
  console.warn(`${"=".repeat(72)}\n`);
}
