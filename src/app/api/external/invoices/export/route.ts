import { NextRequest, NextResponse } from "next/server";
import { invoiceErrorResponse, isInvoiceApiAuthorized, registerCsvResponse } from "@/lib/invoices";

// Server-to-server invoice API, gated by the INVOICE_API_SECRET bearer token
// instead of a NextAuth session (same pattern as /api/external/leads), and
// deliberately left out of middleware.ts's matcher. See README "Invoices".

// Monthly (?month=2026-09) or yearly (?fy=2026-27) register as CSV.
export async function GET(req: NextRequest) {
  if (!isInvoiceApiAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await registerCsvResponse(req.nextUrl.searchParams);
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
