import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const template = await prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!template) throw new ApiError(404, "Template not found");
    if (session.user.role !== "ADMIN" && template.createdById !== session.user.id) {
      throw new ApiError(403, "You can only delete your own templates");
    }

    await prisma.whatsAppTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
