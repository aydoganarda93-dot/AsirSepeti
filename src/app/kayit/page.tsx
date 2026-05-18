"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Kayıt sayfası. NEXT_PUBLIC_TURNSTILE_SITE_KEY tanımlıysa Cloudflare Turnstile
 * widget'ı render edilir ve token form gönderiminde "turnstileToken" alanı
 * olarak iletilir. Site key yoksa widget tamamen atlanır; sunucu da o durumda
 * Turnstile kontrolünü pas geçer (bkz. src/app/api/auth/register/route.ts).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const TURNSTILE_ENABLED = TURNSTILE_SITE_KEY.length > 0;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_ENABLED || !turnstileScriptReady) return;
    const container = turnstileContainerRef.current;
    const turnstile = window.turnstile;
    if (!container || !turnstile || turnstileWidgetIdRef.current) return;

    turnstileWidgetIdRef.current = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
      "error-callback": () => setTurnstileToken(null),
      theme: "light",
    });
  }, [turnstileScriptReady]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      {TURNSTILE_ENABLED ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileScriptReady(true)}
        />
      ) : null}
      <form
        className="w-full space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");

          if (TURNSTILE_ENABLED && !turnstileToken) {
            setError("Bot doğrulaması bekleniyor. Lütfen kutuyu tamamlayın.");
            return;
          }

          setSubmitting(true);

          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              email,
              companyName,
              password,
              ...(TURNSTILE_ENABLED && turnstileToken ? { turnstileToken } : {}),
            }),
          });

          setSubmitting(false);

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            setError(data?.error ?? "Kayıt oluşturulamadı.");
            // Turnstile token tek kullanımlık — başarısız submit sonrası resetle.
            if (TURNSTILE_ENABLED && window.turnstile && turnstileWidgetIdRef.current) {
              window.turnstile.reset(turnstileWidgetIdRef.current);
              setTurnstileToken(null);
            }
            return;
          }

          router.push("/giris?kayit=basarili");
        }}
      >
        <h1 className="text-center text-2xl font-bold tracking-tight">Hesap Oluştur</h1>
        <p className="text-center text-sm text-slate-500">Kendi hesabını oluşturup sisteme giriş yapabilirsin.</p>
        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            type="text"
            placeholder="Ad Soyad"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            type="email"
            placeholder="E-posta Adresi"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            type="text"
            placeholder="İşletme Adı"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            type="password"
            placeholder="Şifre (en az 6 karakter)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </div>
        {TURNSTILE_ENABLED ? (
          <div className="flex justify-center">
            <div ref={turnstileContainerRef} />
          </div>
        ) : null}
        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
        >
          {submitting ? "Hesap Oluşturuluyor..." : "Hesap Oluştur"}
        </button>
        <p className="text-center text-sm text-slate-600">
          Zaten hesabın var mı?{" "}
          <Link href="/giris" className="font-semibold text-green-700 hover:underline">
            Giriş yap
          </Link>
        </p>
      </form>
    </main>
  );
}
