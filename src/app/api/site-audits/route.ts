import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-auth";
import { AUDIT_STATUSES, type AuditStatusValue } from "@/lib/constants";
import { AUDIT_SUMMARY_SELECT, auditAccessWhere } from "@/lib/site-audit/store";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const leadId = searchParams.get("leadId");
    const createdById = searchParams.get("createdById");
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const access = auditAccessWhere(session);
    const filters: Prisma.SiteAuditWhereInput[] = [access];
    if (leadId) filters.push({ leadId });
    if (createdById && session.user.role === "ADMIN") filters.push({ createdById });
    if (search) {
      filters.push({
        OR: [
          { domain: { contains: search, mode: "insensitive" } },
          { pageTitle: { contains: search, mode: "insensitive" } },
          { lead: { name: { contains: search, mode: "insensitive" } } },
          { lead: { company: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    // Stats reflect the search/owner filters but not the status tab, so the
    // tab counts stay meaningful while switching between them.
    const baseWhere: Prisma.SiteAuditWhereInput = { AND: filters };
    const where: Prisma.SiteAuditWhereInput =
      status && (AUDIT_STATUSES as readonly string[]).includes(status) ? { AND: [...filters, { status }] } : baseWhere;

    const orderBy: Prisma.SiteAuditOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ createdAt: "asc" }]
        : sort === "score_asc"
          ? [{ score: "asc" }, { createdAt: "desc" }]
          : sort === "score_desc"
            ? [{ score: "desc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }];

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [audits, total, byStatus, avg, thisWeek] = await Promise.all([
      prisma.siteAudit.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: AUDIT_SUMMARY_SELECT }),
      prisma.siteAudit.count({ where }),
      prisma.siteAudit.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
      prisma.siteAudit.aggregate({ where: baseWhere, _avg: { score: true } }),
      prisma.siteAudit.count({ where: { AND: [...filters, { createdAt: { gte: weekAgo } }] } }),
    ]);

    const statusCounts = Object.fromEntries(AUDIT_STATUSES.map((s) => [s, 0])) as Record<AuditStatusValue, number>;
    for (const row of byStatus) if (row.status in statusCounts) statusCounts[row.status as AuditStatusValue] = row._count._all;
    const all = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      audits,
      total,
      page,
      pageSize: PAGE_SIZE,
      stats: {
        total: all,
        thisWeek,
        avgScore: avg._avg.score == null ? null : Math.round(avg._avg.score),
        byStatus: statusCounts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
