"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <form
        className="w-full space-y-3 rounded-lg border bg-white p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const result = await signIn("credentials", {
            email,
            password,
            callbackUrl: "/admin",
            redirect: false,
          });
          if (result?.error) setError("Giriş başarısız. Bilgileri kontrol edin.");
          if (result?.ok) window.location.href = "/admin";
        }}
      >
        <h1 className="text-xl font-bold">Yönetici Girişi</h1>
        <input
          className="w-full rounded border p-2"
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded bg-black px-4 py-2 font-semibold text-white">Giriş Yap</button>
      </form>
    </main>
  );
}
