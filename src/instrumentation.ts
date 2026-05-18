/**
 * Next.js instrumentation hook (server boot'unda bir kez çalışır).
 *
 * Şu an yalnızca env doğrulama çalıştırıyor; ileride OTel veya Sentry register
 * için aynı dosya genişletilebilir.
 *
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const { validateEnv } = await import("./lib/env");
  validateEnv();
}
