import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";
import { buildLeadsQuery } from "@/lib/leads-query";
import { leadsToCsv } from "@/lib/leads-csv";

// Admin-only CSV export of the Leads list, honoring whatever filters/sort
// are currently applied on the page (same query params as GET /api/leads).
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { where, orderBy } = buildLeadsQuery(session, searchParams);

    const leads = await prisma.lead.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(leadsToCsv(leads), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
