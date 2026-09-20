import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";

const createSourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
});

export async function GET() {
  try {
    await requireAdmin();
    const sources = await prisma.leadSource.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ sources });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = createSourceSchema.parse(body);

    const existing = await prisma.leadSource.findUnique({ where: { name: data.name } });
    if (existing) {
      return NextResponse.json({ error: "This source already exists" }, { status: 409 });
    }

    const source = await prisma.leadSource.create({ data: { name: data.name } });
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
