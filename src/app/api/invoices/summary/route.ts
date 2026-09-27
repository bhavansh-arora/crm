import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getInvoiceSummary, invoiceErrorResponse } from "@/lib/invoices";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ summary: await getInvoiceSummary() });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
