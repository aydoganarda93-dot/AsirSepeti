import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim. Yönetici yetkisi gerekiyor." }, { status: 401 });
  }
  return null;
}

/** Aylık menü gibi müşteri alanları: fabrika hesabı veya yönetici önizleme. */
export async function ensureCustomerOrAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") return null;
  if (session?.user?.role === "CUSTOMER" && session.user.companyId) return null;
  return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
}
