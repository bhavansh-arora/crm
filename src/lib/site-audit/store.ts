import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-auth";
import type { AuditReport } from "./types";

// Saved audits: admins see everyone's; a rep sees the audits they ran plus
// any attached to a lead assigned to them.
export function auditAccessWhere(session: Session): Prisma.SiteAuditWhereInput {
  if (session.user.role === "ADMIN") return {};
  return { OR: [{ createdById: session.user.id }, { lead: { assignedToId: session.user.id } }] };
}

export async function getAuditOr404(id: string, session: Session) {
  const audit = await prisma.siteAudit.findFirst({ where: { AND: [{ id }, auditAccessWhere(session)] } });
  if (!audit) throw new ApiError(404, "Audit not found");
  return audit;
}

// A lead can only be attached by someone allowed to work it.
export async function assertLeadAccess(leadId: string, session: Session) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedToId: true } });
  if (!lead) throw new ApiError(404, "Lead not found");
  if (session.user.role !== "ADMIN" && lead.assignedToId !== session.user.id) throw new ApiError(403, "Forbidden");
}

export async function saveAudit(report: AuditReport, opts: { userId: string; leadId?: string | null }) {
  return prisma.siteAudit.create({
    data: {
      url: report.finalUrl,
      domain: report.domain,
      pageTitle: report.pageTitle,
      score: report.overallScore,
      grade: report.grade,
      siteType: report.content.siteType,
      verdict: report.ai?.headline ?? null,
      report: report as unknown as Prisma.InputJsonValue,
      leadId: opts.leadId ?? null,
      createdById: opts.userId,
    },
    select: { id: true },
  });
}

export const AUDIT_SUMMARY_SELECT = {
  id: true,
  url: true,
  domain: true,
  pageTitle: true,
  score: true,
  grade: true,
  siteType: true,
  verdict: true,
  status: true,
  notes: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
  lead: { select: { id: true, name: true, company: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.SiteAuditSelect;

export type AuditSummary = Prisma.SiteAuditGetPayload<{ select: typeof AUDIT_SUMMARY_SELECT }>;
