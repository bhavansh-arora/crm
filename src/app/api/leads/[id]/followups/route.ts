import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";

const createFollowUpSchema = z.object({
  dueAt: z.coerce.date().refine((d) => d.getTime() >= Date.now() - 60_000, {
    message: "Follow-up date can't be in the past",
  }),
  note: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (session.user.role === "SALES_REP" && lead.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await req.json();
    const data = createFollowUpSchema.parse(body);

    const followUp = await prisma.followUp.create({
      data: {
        leadId: id,
        userId: session.user.id,
        dueAt: data.dueAt,
        note: data.note || null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
