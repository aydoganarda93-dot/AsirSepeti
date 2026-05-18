import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    const { token } = req.nextauth;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/giris", req.url));
    }

    if (path === "/" && !token) {
      return NextResponse.redirect(new URL("/giris", req.url));
    }

    // Zaten girişli kullanıcıyı kayıt sayfasında tutmak anlamsız — ana sayfaya gönder.
    if (path === "/kayit" && token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // /kayit her zaman erişilebilir (oturum yokken kayıt olabilsin).
        if (req.nextUrl.pathname === "/kayit") return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/giris",
    },
  },
);

export const config = {
  matcher: ["/admin/:path*", "/", "/kayit"],
};
