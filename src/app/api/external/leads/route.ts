import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizePhone, loadPhoneLookup } from "@/lib/duplicate-lead";
import { LEAD_STATUSES, LEAD_TEMPERATURES } from "@/lib/constants";

// Server-to-server ingestion endpoint for other internal tools (e.g. the
// Leads Finder app) to push leads in -- not a browser-facing route, so it's
// deliberately left out of middleware.ts's matcher and gated by its own
// bearer secret instead of a NextAuth session, same pattern as
// /api/cron/reminders and /api/webhooks/razorpay.
const leadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  company: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  assignedToId: z.string().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional(),
  note: z.string().optional(),
});

const bodySchema = z.object({
  source: z.string().min(1),
  leads: z.array(leadSchema).max(200),
});

// GET ?phone=... looks up a lead by normalized phone, for a caller that
// needs the lead's id before it can PATCH it or add an activity -- same
// bearer-secret auth as POST below.
export async function GET(req: NextRequest) {
  const expected = process.env.EXTERNAL_LEADS_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Pass ?phone=" }, { status: 400 });

  const normalized = normalizePhone(phone);
  if (!normalized) return NextResponse.json({ found: false });

  const leads = await prisma.lead.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, source: true, status: true, assignedToId: true },
  });
  const match = leads.find((l) => normalizePhone(l.phone) === normalized);

  return NextResponse.json(match ? { found: true, lead: match } : { found: false });
}

export async function POST(req: NextRequest) {
  const expected = process.env.EXTERNAL_LEADS_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let data;
  try {
    data = bodySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await prisma.leadSource.upsert({
    where: { name: data.source },
    update: {},
    create: { name: data.source, active: true },
  });

  const results: { phone: string; status: "created" | "duplicate" }[] = [];
  let created = 0;

  // Normalized (digits only, country code applied), not an exact string
  // match -- a lead already in the CRM as "9876543210" and an incoming
  // "+91 98765 43210" for the same person are the same number even though
  // the strings differ. Loaded once for the whole batch rather than
  // per-lead: sequential processing (not Promise.all) still keeps this
  // race-free against two leads in the same batch sharing a phone, since
  // each create()'s result is added to the lookup before the next check.
  const phoneLookup = await loadPhoneLookup();

  // Validated once for the whole batch, same reasoning as phoneLookup above
  // -- an assignedToId naming a user who's been deactivated or deleted since
  // the Leads Finder last fetched its team list would otherwise fail the
  // create with a foreign-key error; silently leaving those leads
  // unassigned is safer than rejecting the whole batch over one stale id.
  const activeUserIds = new Set(
    (await prisma.user.findMany({ where: { active: true }, select: { id: true } })).map(
      (u) => u.id
    )
  );

  for (const lead of data.leads) {
    const phone = lead.phone.trim();
    const normalized = normalizePhone(phone);
    if (normalized && phoneLookup.has(normalized)) {
      results.push({ phone, status: "duplicate" });
      continue;
    }

    const assignedToId =
      lead.assignedToId && activeUserIds.has(lead.assignedToId) ? lead.assignedToId : null;

    const newLead = await prisma.lead.create({
      data: {
        name: lead.name,
        company: lead.company || lead.name,
        phone,
        website: lead.website || null,
        email: lead.email || null,
        source: data.source,
        status: lead.status || "NEW",
        temperature: lead.temperature || null,
        value: 0,
        assignedToId,
      },
    });
    if (lead.note) {
      await prisma.activity.create({
        data: {
          leadId: newLead.id,
          userId: assignedToId,
          type: "NOTE",
          note: lead.note,
        },
      });
    }
    if (normalized) phoneLookup.set(normalized, { id: newLead.id, name: newLead.name });
    results.push({ phone, status: "created" });
    created += 1;
  }

  return NextResponse.json({ created, duplicate: results.length - created, results });
}
