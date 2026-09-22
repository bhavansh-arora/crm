import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-auth";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  body: z.string().min(1, "Message body is required"),
});

export async function GET() {
  try {
    await requireSession();
    const templates = await prisma.whatsAppTemplate.findMany({
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = createTemplateSchema.parse(body);

    const template = await prisma.whatsAppTemplate.create({
      data: { name: data.name, body: data.body, createdById: session.user.id },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
