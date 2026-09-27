import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { invoiceErrorResponse, registerCsvResponse } from "@/lib/invoices";

// Monthly (?month=2026-09) or yearly (?fy=2026-27) invoice register as CSV.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    return await registerCsvResponse(req.nextUrl.searchParams);
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
