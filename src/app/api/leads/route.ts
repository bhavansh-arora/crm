import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin, handleApiError } from "@/lib/api-auth";
import { LEAD_STATUSES } from "@/lib/constants";

const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  value: z.coerce.number().min(0).default(0),
  assignedToId: z.string().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assignedToId = searchParams.get("assignedToId");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (session.user.role === "SALES_REP") {
      where.assignedToId = session.user.id;
    } else if (assignedToId) {
      where.assignedToId = assignedToId === "unassigned" ? null : assignedToId;
    }

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { company: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { activities: true, followUps: { where: { completed: false } } } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ leads });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = createLeadSchema.parse(body);

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        source: data.source || null,
        value: data.value,
        assignedToId: data.assignedToId || null,
        status: data.status || "NEW",
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
