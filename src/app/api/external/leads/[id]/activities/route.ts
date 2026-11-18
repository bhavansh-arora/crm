import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Server-to-server addition of a NOTE activity to an existing lead, same
// bearer-secret auth as the rest of /api/external. userId defaults to the
// lead's current assignee so the note shows up as coming from whoever owns
// the lead; pass it explicitly to attribute it to someone else.
const bodySchema = z.object({
  note: z.string().min(1),
  userId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const expected = process.env.EXTERNAL_LEADS_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let data;
  try {
    data = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (data.userId) {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return NextResponse.json({ error: "userId not found" }, { status: 400 });
  }

  const activity = await prisma.activity.create({
    data: {
      leadId: id,
      userId: data.userId || lead.assignedToId,
      type: "NOTE",
      note: data.note,
    },
  });

  return NextResponse.json({ activity }, { status: 201 });
}
