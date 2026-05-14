"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  company: { name: string } | null;
};

export default function AdminUsersPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("CUSTOMER");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Kullanıcılar alınamadı");
      return (await res.json()) as User[];
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role, companyName }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Bir hata oluştu");
      return;
    }
    setEmail("");
    setPassword("");
    setName("");
    setCompanyName("");
    usersQuery.refetch();
  };

  return (
    <main className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Kullanıcı Yönetimi</h1>
        <Link href="/admin" className="text-sm font-semibold underline text-slate-600 hover:text-black">
          Geri Dön
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 align-top">
        <form onSubmit={onSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 md:col-span-1 h-fit">
          <h2 className="font-semibold text-lg border-b pb-2">Yeni Kullanıcı / Fabrika Ekle</h2>
          <input
            className="w-full border p-2 rounded"
            placeholder="Kişi / Temsilci Adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full border p-2 rounded"
            type="email"
            placeholder="E-posta (Giriş için)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border p-2 rounded"
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select
            className="w-full border p-2 rounded"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="CUSTOMER">Fabrika (Müşteri)</option>
            <option value="ADMIN">Yönetici</option>
          </select>
          {role === "CUSTOMER" && (
            <input
              className="w-full border p-2 rounded"
              placeholder="Firma / Fabrika Adı"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={loading} className="w-full bg-black text-white p-2 rounded font-semibold disabled:opacity-50">
            {loading ? "Ekleniyor..." : "Ekle"}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm md:col-span-2 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3">İsim</th>
                <th className="p-3">E-posta</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Firma</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data?.map(user => (
                <tr key={user.id} className="border-t">
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-slate-600">{user.email}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${user.role === "ADMIN" ? "bg-red-100 text-red-800" : user.role === "KITCHEN" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
                      {user.role === "KITCHEN" ? "Mutfak (eski)" : user.role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{user.company?.name || "-"}</td>
                </tr>
              ))}
              {!usersQuery.data?.length && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">Kullanıcı bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
