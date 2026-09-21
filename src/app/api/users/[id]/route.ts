import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ApiError, handleApiError } from "@/lib/api-auth";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "SALES_REP"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdmin();
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "User not found");

    const body = await req.json();
    const data = updateUserSchema.parse(body);

    const updateData: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      active: data.active,
    };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });

    return NextResponse.json({ user });
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
    const session = await requireAdmin();

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, _count: { select: { leads: true } } },
    });
    if (!existing) throw new ApiError(404, "User not found");

    if (id === session.user.id) {
      throw new ApiError(400, "You can't delete your own account");
    }

    if (existing.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new ApiError(400, "Can't delete the last remaining admin");
      }
    }

    if (existing._count.leads > 0) {
      throw new ApiError(
        400,
        `Reassign ${existing._count.leads} lead${existing._count.leads === 1 ? "" : "s"} away from this user before deleting them`
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
