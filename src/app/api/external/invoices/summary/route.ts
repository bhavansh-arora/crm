import { NextRequest, NextResponse } from "next/server";
import { getInvoiceSummary, invoiceErrorResponse, isInvoiceApiAuthorized } from "@/lib/invoices";

// Server-to-server invoice API, gated by the INVOICE_API_SECRET bearer token
// instead of a NextAuth session (same pattern as /api/external/leads), and
// deliberately left out of middleware.ts's matcher. See README "Invoices".

// Yearly (financial year) and monthly totals.
export async function GET(req: NextRequest) {
  if (!isInvoiceApiAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ summary: await getInvoiceSummary() });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
