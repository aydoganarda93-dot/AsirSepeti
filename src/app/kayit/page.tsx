"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <form
        className="w-full space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSubmitting(true);

          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              email,
              companyName,
              password,
            }),
          });

          setSubmitting(false);

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            setError(data?.error ?? "Kayıt oluşturulamadı.");
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
