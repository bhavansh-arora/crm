import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvoicePdf, invoiceErrorResponse, isInvoiceApiAuthorized, pdfResponse } from "@/lib/invoices";

// Server-to-server invoice API, gated by the INVOICE_API_SECRET bearer token
// instead of a NextAuth session (same pattern as /api/external/leads), and
// deliberately left out of middleware.ts's matcher. See README "Invoices".

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isInvoiceApiAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return pdfResponse(invoice.invoiceNumber, await getInvoicePdf(invoice), true);
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
