import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";

const createSourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
});

export async function GET() {
  try {
    await requireAdmin();
    // Lead.source is a plain string, not a foreign key to LeadSource (leads
    // can carry a source name after it's been renamed/retired), so counts
    // are joined by name via a separate groupBy rather than a Prisma relation.
    const [sources, counts] = await Promise.all([
      prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
      prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
    ]);
    const countBySource = new Map(counts.map((c) => [c.source, c._count._all]));
    const withCounts = sources.map((s) => ({ ...s, leadCount: countBySource.get(s.name) || 0 }));
    return NextResponse.json({ sources: withCounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = createSourceSchema.parse(body);

    const existing = await prisma.leadSource.findUnique({ where: { name: data.name } });
    if (existing) {
      return NextResponse.json({ error: "This source already exists" }, { status: 409 });
    }

    const source = await prisma.leadSource.create({ data: { name: data.name } });
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
