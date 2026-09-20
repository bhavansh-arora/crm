import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const adminOnlyPrefixes = ["/team", "/api/users"];
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
    "/api/leads/:path*",
    "/api/users/:path*",
    "/api/followups/:path*",
    "/api/dashboard/:path*",
  ],
};
