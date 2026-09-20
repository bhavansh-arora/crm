import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin, ApiError, handleApiError } from "@/lib/api-auth";
import { LEAD_STATUSES } from "@/lib/constants";

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  value: z.coerce.number().min(0).optional(),
  assignedToId: z.string().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
});

async function getLeadOr404(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new ApiError(404, "Lead not found");
  return lead;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        activities: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        followUps: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { dueAt: "asc" },
        },
      },
    });

    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (session.user.role === "SALES_REP" && lead.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const existing = await getLeadOr404(id);

    if (session.user.role === "SALES_REP" && existing.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await req.json();
    const data = updateLeadSchema.parse(body);

    // Sales reps may only change the status of their own lead; everything
    // else (reassignment, master data edits) is admin-only.
    if (session.user.role === "SALES_REP") {
      const allowedKeys = Object.keys(data).filter((k) => k !== "status");
      if (allowedKeys.length > 0) {
        throw new ApiError(403, "Only status can be updated");
      }
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.email === "") updateData.email = null;

    if (data.status && data.status !== existing.status) {
      updateData.statusChangedAt = new Date();
      updateData.closedAt = data.status === "WON" || data.status === "LOST" ? new Date() : null;
    }

    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: updateData,
        include: { assignedTo: { select: { id: true, name: true } } },
      });

      if (data.status && data.status !== existing.status) {
        await tx.activity.create({
          data: {
            leadId: id,
            userId: session.user.id,
            type: "STATUS_CHANGE",
            fromStatus: existing.status,
            toStatus: data.status,
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdmin();
    await getLeadOr404(id);
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
