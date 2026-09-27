import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getInvoiceDashboard, invoiceErrorResponse } from "@/lib/invoices";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ dashboard: await getInvoiceDashboard() });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
