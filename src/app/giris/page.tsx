"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const registerSuccess = searchParams.get("kayit") === "basarili";
  const mutfakKaldirildi = searchParams.get("mutfak") === "kapali";

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    if (session.user.role === "ADMIN") {
      router.replace("/admin");
      return;
    }

    if (session.user.role === "KITCHEN") {
      void (async () => {
        await signOut({ redirect: false });
        router.replace("/giris?mutfak=kapali");
      })();
      return;
    }

    router.replace("/");
  }, [status, session, router]);

  if (status === "loading" || status === "authenticated") {
    return <div className="p-4">Yükleniyor...</div>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <form
        className="w-full space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (result?.error) setError("E-posta veya şifre hatalı.");
        }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-center">Giriş Yap</h1>
        {mutfakKaldirildi ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-sm text-slate-700">
            Mutfak paneli artık kullanılmıyor. Erişim için yöneticinizle iletişime geçin veya fabrika hesabı ile giriş yapın.
          </p>
        ) : null}
        {registerSuccess ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center text-sm text-emerald-700">
            Hesabın oluşturuldu. Şimdi giriş yapabilirsin.
          </p>
        ) : null}
        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            type="email"
            placeholder="E-posta Adresi"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}
        <button type="submit" className="w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800">
          Sisteme Gir
        </button>
        <p className="text-center text-sm text-slate-600">
          Hesabın yok mu?{" "}
          <Link href="/kayit" className="font-semibold text-green-700 hover:underline">
            Kayıt ol
          </Link>
        </p>
      </form>
    </main>
  );
}
