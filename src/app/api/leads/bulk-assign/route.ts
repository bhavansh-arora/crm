import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";

const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, "Select at least one lead"),
  assignedToId: z.string().nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = bulkAssignSchema.parse(body);

    const result = await prisma.lead.updateMany({
      where: { id: { in: data.leadIds } },
      data: { assignedToId: data.assignedToId },
    });

    return NextResponse.json({ count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
