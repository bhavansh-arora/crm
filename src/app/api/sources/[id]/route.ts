import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ApiError, handleApiError } from "@/lib/api-auth";

const updateSourceSchema = z.object({
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdmin();
    const existing = await prisma.leadSource.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Source not found");

    const body = await req.json();
    const data = updateSourceSchema.parse(body);

    const source = await prisma.leadSource.update({ where: { id }, data });
    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
