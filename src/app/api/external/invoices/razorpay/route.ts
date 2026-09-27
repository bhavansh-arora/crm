import { NextRequest, NextResponse } from "next/server";
import { importFromRazorpay, invoiceErrorResponse, isInvoiceApiAuthorized } from "@/lib/invoices";

// Server-to-server invoice API, gated by the INVOICE_API_SECRET bearer token
// instead of a NextAuth session (same pattern as /api/external/leads), and
// deliberately left out of middleware.ts's matcher. See README "Invoices".

// Body: { paymentId: "pay_..." } or { from: "2026-09-01", to: "2026-09-30" }
export async function POST(req: NextRequest) {
  if (!isInvoiceApiAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await importFromRazorpay(await req.json(), { source: "RAZORPAY" }));
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
