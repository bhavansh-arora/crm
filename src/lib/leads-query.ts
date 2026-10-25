import type { Session } from "next-auth";
import { Prisma } from "@prisma/client";
import { OPEN_STATUSES } from "@/lib/constants";

// Shared between GET /api/leads (the list view) and GET /api/leads/export
// (CSV download) so the export always matches whatever's currently
// filtered/sorted on the Leads page -- same role scoping, same query params.
const STALE_DAYS = 3;

export function buildLeadsQuery(session: Session, searchParams: URLSearchParams) {
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

  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    sort === "value_desc"
      ? [{ value: "desc" }]
      : sort === "stale_first"
        ? [{ statusChangedAt: "asc" }]
        : sort === "source_asc"
          ? [{ source: { sort: "asc", nulls: "last" } }, { name: "asc" }]
          : [{ updatedAt: "desc" }];

  return { where: where as Prisma.LeadWhereInput, orderBy };
}
