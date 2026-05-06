import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  if (!isAdminPath) return NextResponse.next();

  const authToken = request.cookies.get("next-auth.session-token")?.value;
  if (authToken) return NextResponse.next();

  const loginUrl = new URL("/api/auth/signin", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
