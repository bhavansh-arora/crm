import { NextRequest, NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { importFromRazorpay, invoiceErrorResponse } from "@/lib/invoices";

// Scheduled Razorpay -> invoice sync: issues an invoice for every captured
// payment from the last 3 days that doesn't have one yet (already-invoiced
// payments are skipped). deploy/setup-vps.sh runs this every 15 minutes via
// crontab, so invoices appear on their own with no webhook setup needed;
// the webhook just makes it instant. Gated by CRON_SECRET like
// /api/cron/reminders.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ skipped: "Razorpay is not configured" });
  }
  try {
    const { created, skipped, failed } = await importFromRazorpay({ lastDays: 3 });
    return NextResponse.json({ created, skipped, failed });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
