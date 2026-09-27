import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isInvoicesHost } from "@/lib/invoices-host";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // invoices.codebunny.net is an invoices-only site -- the CRM's other
    // pages send you back to the invoice dashboard (APIs are left alone).
    if (isInvoicesHost(req.headers.get("host"))) {
      // Invoices are admin-only; the CRM's usual "send reps to /leads"
      // would just bounce back here, so say so instead.
      if (role !== "ADMIN") {
        return new NextResponse("Invoices are only available to admin accounts.", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      if (!pathname.startsWith("/invoices") && !pathname.startsWith("/api")) {
        return NextResponse.redirect(new URL("/invoices", req.url));
      }
    }

    const adminOnlyPrefixes = [
      "/team",
      "/api/users",
      "/sources",
      "/api/sources",
      "/activity",
      "/api/admin",
      "/invoices",
      "/api/invoices",
    ];
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
  },
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
    "/invoices/:path*",
    "/api/leads/:path*",
    "/api/users/:path*",
    "/api/followups/:path*",
    "/api/dashboard/:path*",
    "/api/sources/:path*",
    "/api/admin/:path*",
    "/api/payment-links/:path*",
    "/api/whatsapp-templates/:path*",
    "/api/invoices/:path*",
    "/api/heartbeat",
  ],
};
