import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";
import { CALL_OUTCOMES } from "@/lib/constants";

const createActivitySchema = z.object({
  type: z.enum(["NOTE", "CALL"]),
  note: z.string().optional(),
  callOutcome: z.enum(CALL_OUTCOMES).optional(),
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
    const data = createActivitySchema.parse(body);

    if (data.type === "CALL" && !data.callOutcome) {
      throw new ApiError(400, "callOutcome is required for calls");
    }
    if (data.type === "NOTE" && !data.note?.trim()) {
      throw new ApiError(400, "Note text is required");
    }

    let callNumber: number | undefined;
    if (data.type === "CALL") {
      const priorCalls = await prisma.activity.count({
        where: { leadId: id, type: "CALL" },
      });
      callNumber = priorCalls + 1;
    }

    const activity = await prisma.activity.create({
      data: {
        leadId: id,
        userId: session.user.id,
        type: data.type,
        note: data.note || null,
        callOutcome: data.type === "CALL" ? data.callOutcome : null,
        callNumber,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await prisma.lead.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
