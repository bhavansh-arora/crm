import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@/lib/constants";

// Server-to-server update of an existing lead (found via GET
// /api/external/leads?phone=...), same bearer-secret auth as the rest of
// /api/external. Only touches fields that are actually passed, so a
// partial update (e.g. just the source) doesn't clobber everything else.
const patchSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().min(1).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const expected = process.env.EXTERNAL_LEADS_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let data;
  try {
    data = patchSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (data.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!assignee || !assignee.active) {
      return NextResponse.json({ error: "assignedToId is not an active user" }, { status: 400 });
    }
  }

  if (data.source) {
    await prisma.leadSource.upsert({
      where: { name: data.source },
      update: {},
      create: { name: data.source, active: true },
    });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.company !== undefined && { company: data.company || null }),
      ...(data.website !== undefined && { website: data.website || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.source !== undefined && { source: data.source }),
      ...(data.status !== undefined && { status: data.status, statusChangedAt: new Date() }),
      ...(data.temperature !== undefined && { temperature: data.temperature }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
    },
  });

  return NextResponse.json({ lead });
}
