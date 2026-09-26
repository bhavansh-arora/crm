import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const adminOnlyPrefixes = ["/team", "/api/users", "/sources", "/api/sources", "/activity", "/api/admin"];
    if (adminOnlyPrefixes.some((p) => pathname.startsWith(p)) && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/leads", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/team/:path*",
    "/followups/:path*",
    "/sources/:path*",
    "/activity/:path*",
    "/dialer/:path*",
    "/templates/:path*",
    "/audit/:path*",
    "/api/leads/:path*",
    "/api/users/:path*",
    "/api/followups/:path*",
    "/api/dashboard/:path*",
    "/api/sources/:path*",
    "/api/admin/:path*",
    "/api/payment-links/:path*",
    "/api/whatsapp-templates/:path*",
    "/api/site-audit/:path*",
    "/api/heartbeat",
  ],
};
