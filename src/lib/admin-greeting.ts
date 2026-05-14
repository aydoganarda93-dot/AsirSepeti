import type { Session } from "next-auth";

/** Karşılama ve profil menüsü için görünen ad */
export function adminDisplayName(session: Session | null): string {
  const raw = session?.user?.name?.trim();
  if (raw) return raw;
  const email = session?.user?.email?.trim();
  if (!email) return "Yönetici";
  const local = email.split("@")[0] ?? "Yönetici";
  if (!local) return "Yönetici";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
