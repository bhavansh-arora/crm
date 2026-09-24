import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin, handleApiError } from "@/lib/api-auth";
import { LEAD_STATUSES, LEAD_TEMPERATURES, OPEN_STATUSES } from "@/lib/constants";
import { normalizePhone, loadPhoneLookup } from "@/lib/duplicate-lead";

const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  source: z.string().optional(),
  value: z.coerce.number().min(0).default(0),
  assignedToId: z.string().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  temperature: z.enum(LEAD_TEMPERATURES).optional().nullable(),
});

// A lead counts as "stale" once its status hasn't moved in this many days
// (and it's still open — WON/LOST leads are done, not stale).
const STALE_DAYS = 3;

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const temperature = searchParams.get("temperature");
    const assignedToId = searchParams.get("assignedToId");
    const source = searchParams.get("source");
    const search = searchParams.get("search");
    const filter = searchParams.get("filter"); // "due_today" | "overdue" | "stale"
    const sort = searchParams.get("sort") || "updated_desc";

    const where: Record<string, unknown> = {};

    if (session.user.role === "SALES_REP") {
      where.assignedToId = session.user.id;
    } else if (assignedToId) {
      where.assignedToId = assignedToId === "unassigned" ? null : assignedToId;
    }

    if (status) where.status = status;
    if (temperature) where.temperature = temperature;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const now = new Date();
    if (filter === "due_today") {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      where.followUps = { some: { completed: false, dueAt: { gte: startOfDay, lte: endOfDay } } };
    } else if (filter === "overdue") {
      where.followUps = { some: { completed: false, dueAt: { lt: now } } };
    } else if (filter === "stale") {
      const staleBefore = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
      where.status = { in: OPEN_STATUSES };
      where.statusChangedAt = { lt: staleBefore };
    }

    // Arrays (not a single object) so ties get a stable, predictable
    // secondary order instead of whatever order Postgres feels like.
    const orderBy =
      sort === "value_desc"
        ? [{ value: "desc" as const }]
        : sort === "stale_first"
          ? [{ statusChangedAt: "asc" as const }]
          : sort === "source_asc"
            ? [{ source: { sort: "asc" as const, nulls: "last" as const } }, { name: "asc" as const }]
            : [{ updatedAt: "desc" as const }];

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { activities: true, followUps: { where: { completed: false } } } },
        followUps: {
          where: { completed: false },
          orderBy: { dueAt: "asc" },
          take: 1,
          select: { id: true, dueAt: true },
        },
      },
      orderBy,
    });

    return NextResponse.json({ leads });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = createLeadSchema.parse(body);

    const normalizedNew = normalizePhone(data.phone);
    if (normalizedNew) {
      const lookup = await loadPhoneLookup();
      const dupe = lookup.get(normalizedNew);
      if (dupe) {
        return NextResponse.json(
          { error: `A lead with this phone number already exists: "${dupe.name}"` },
          { status: 409 }
        );
      }
    }

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        contactName: data.contactName || null,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        website: data.website || null,
        source: data.source || null,
        value: data.value,
        assignedToId: data.assignedToId || null,
        status: data.status || "NEW",
        temperature: data.temperature || null,
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
