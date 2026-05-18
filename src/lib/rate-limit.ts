import { db } from "@/lib/db";

/** IP adresini öncelikle x-forwarded-for başlığından okur (Vercel proxy zinciri). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Sliding window log eski kayıtları sonsuza kadar tutmasın diye 7 gün retention. */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * RateLimitLog tablosu üzerinden sliding-window kontrol.
 * `action` farklı endpoint'leri ayrıştırmak için (ör. "create-order", "register").
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  { windowMs, max }: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartDate = new Date(now - windowMs);

  const recent = await db.rateLimitLog.findMany({
    where: { ip, action, createdAt: { gt: windowStartDate } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (recent.length >= max) {
    const oldestInWindow = recent[0]?.createdAt.getTime() ?? now;
    const retryAfterMs = Math.max(0, oldestInWindow + windowMs - now);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  await db.rateLimitLog.create({
    data: { ip, action },
  });

  // Asenkron temizlik; başarısız olsa da rate limit kararını etkilemez.
  void db.rateLimitLog.deleteMany({
    where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
  });

  return { allowed: true, retryAfterSeconds: 0 };
}
