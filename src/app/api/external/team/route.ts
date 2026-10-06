import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same server-to-server auth as /api/external/leads and /api/external/sources
// -- lets the Leads Finder populate an "assign to" picker with the CRM's real
// active team, so a pushed lead's assignedToId always refers to someone that
// actually exists here.
export async function GET(req: NextRequest) {
  const expected = process.env.EXTERNAL_LEADS_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ team: users });
}
