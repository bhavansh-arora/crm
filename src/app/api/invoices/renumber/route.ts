import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireAdmin } from "@/lib/api-auth";
import { renumberFinancialYear } from "@/lib/invoices";

// One-off maintenance endpoint (no UI button on purpose -- this rewrites
// invoice numbers and PDFs, so it's meant to be called deliberately, once).
// Body: { financialYear: "2026-27", apply?: boolean }
// apply defaults to false: without it, returns the renumbering plan only,
// nothing is written. Pass apply: true to actually commit it.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const financialYear = String(body.financialYear || "");
    if (!/^\d{4}-\d{2}$/.test(financialYear)) {
      return NextResponse.json({ error: 'financialYear must look like "2026-27"' }, { status: 400 });
    }
    const result = await renumberFinancialYear(financialYear, { apply: body.apply === true });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
