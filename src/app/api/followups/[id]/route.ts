import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";

const updateFollowUpSchema = z.object({
  completed: z.boolean().optional(),
  dueAt: z.coerce
    .date()
    .refine((d) => d.getTime() >= Date.now() - 60_000, { message: "Follow-up date can't be in the past" })
    .optional(),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!followUp) throw new ApiError(404, "Follow-up not found");
    if (session.user.role === "SALES_REP" && followUp.lead.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await req.json();
    const data = updateFollowUpSchema.parse(body);

    const updated = await prisma.followUp.update({
      where: { id },
      data,
    });

    return NextResponse.json({ followUp: updated });
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
    const session = await requireSession();
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!followUp) throw new ApiError(404, "Follow-up not found");
    if (session.user.role === "SALES_REP" && followUp.lead.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    await prisma.followUp.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
