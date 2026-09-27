import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInvoice, invoiceErrorResponse, isInvoiceApiAuthorized, listInvoicesWhere } from "@/lib/invoices";

// Server-to-server invoice API, gated by the INVOICE_API_SECRET bearer token
// instead of a NextAuth session (same pattern as /api/external/leads), and
// deliberately left out of middleware.ts's matcher. See README "Invoices".

// GET ?month=2026-09 | ?fy=2026-27, optional ?status=PAID|UNPAID|CANCELLED, ?q=
export async function GET(req: NextRequest) {
  if (!isInvoiceApiAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const invoices = await prisma.invoice.findMany({
      where: listInvoicesWhere(req.nextUrl.searchParams),
      orderBy: [{ invoiceDate: "desc" }, { sequence: "desc" }],
      take: 500,
    });
    return NextResponse.json({ invoices });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}

// POST a manual invoice: { customerName, items: [{ description, quantity, rate }], ... }
export async function POST(req: NextRequest) {
  if (!isInvoiceApiAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const invoice = await createInvoice(await req.json(), { source: "API" });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
