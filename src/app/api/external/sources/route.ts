import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Same server-to-server auth as /api/external/leads -- lets the Leads Finder
// populate its "push under which source" picker with the CRM's real,
// current list instead of a fixed env value.
export async function GET(req: NextRequest) {
  const expected = process.env.EXTERNAL_LEADS_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.leadSource.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ sources: sources.map((s) => s.name) });
}
