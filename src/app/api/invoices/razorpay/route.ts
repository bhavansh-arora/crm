import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { importFromRazorpay, invoiceErrorResponse } from "@/lib/invoices";

// Body: { paymentId: "pay_..." } for one payment, or
// { from: "2026-09-01", to: "2026-09-30" } for every captured payment in
// that range. Payments that already have an invoice are skipped.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const result = await importFromRazorpay(await req.json(), { createdById: session.user.id });
    return NextResponse.json(result);
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
