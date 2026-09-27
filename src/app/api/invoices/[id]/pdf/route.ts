import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ApiError } from "@/lib/api-auth";
import { getInvoicePdf, invoiceErrorResponse, pdfResponse } from "@/lib/invoices";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    return pdfResponse(invoice.invoiceNumber, await getInvoicePdf(invoice), req.nextUrl.searchParams.has("download"));
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
