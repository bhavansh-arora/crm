import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";

const updateActivitySchema = z.object({
  note: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id, activityId } = await params;
    const session = await requireSession();

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (session.user.role === "SALES_REP" && lead.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    const existing = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!existing || existing.leadId !== id) throw new ApiError(404, "Activity not found");

    const data = updateActivitySchema.parse(await req.json());
    const note = data.note?.trim() || null;
    if (existing.type === "NOTE" && !note) {
      throw new ApiError(400, "Note text is required");
    }

    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: { note, editedAt: new Date() },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
