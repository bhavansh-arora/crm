import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-auth";
import { auditAccessWhere } from "@/lib/site-audit/store";

// The phone screenshot for the audits dashboard, pulled straight out of the
// stored report so listing audits never has to load the full JSON.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const allowed = await prisma.siteAudit.findFirst({ where: { AND: [{ id }, auditAccessWhere(session)] }, select: { id: true } });
    if (!allowed) return new NextResponse(null, { status: 404 });

    const rows = await prisma.$queryRaw<{ shot: string | null }[]>(
      Prisma.sql`SELECT COALESCE(report->>'mobileScreenshot', report->>'screenshot') AS shot FROM "SiteAudit" WHERE id = ${id}`
    );
    const m = rows[0]?.shot?.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
    if (!m) return new NextResponse(null, { status: 404 });
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400, immutable" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
