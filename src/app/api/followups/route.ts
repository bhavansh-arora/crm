import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "open";

    const where: Record<string, unknown> = {};
    if (session.user.role === "SALES_REP") {
      where.lead = { assignedToId: session.user.id };
    }
    if (scope === "open") where.completed = false;

    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, company: true, status: true, assignedToId: true, assignedTo: { select: { name: true } } } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { dueAt: "asc" },
    });

    return NextResponse.json({ followUps });
  } catch (error) {
    return handleApiError(error);
  }
}
