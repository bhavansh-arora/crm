import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-auth";
import { AUDIT_STATUSES } from "@/lib/constants";
import { AUDIT_SUMMARY_SELECT, assertLeadAccess, getAuditOr404 } from "@/lib/site-audit/store";
import type { AuditReport } from "@/lib/site-audit/types";

const SceneSchema = z.object({
  kind: z.enum(["intro", "mobile", "headline", "funnel", "proof", "walkthrough", "issue", "outro", "cta"]),
  title: z.string().max(300),
  narration: z.string().max(3000),
  focus: z.number().min(0).max(1),
  span: z.number().min(0).max(1).optional(),
  visual: z.enum(["page", "missing", "google", "none"]).optional(),
  bullets: z.array(z.string().max(300)).max(6).optional(),
  currentHeadline: z.string().max(500).optional(),
  rewrite: z.string().max(500).optional(),
  quote: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  status: z.enum(AUDIT_STATUSES).optional(),
  notes: z.string().max(5000).nullable().optional(),
  leadId: z.string().nullable().optional(),
  videoScript: z.array(SceneSchema).min(1).max(30).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const audit = await getAuditOr404(id, session);
    const summary = await prisma.siteAudit.findUnique({ where: { id: audit.id }, select: AUDIT_SUMMARY_SELECT });
    return NextResponse.json({ audit: summary, report: audit.report });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const audit = await getAuditOr404(id, session);
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid update");
    const { status, notes, leadId, videoScript } = parsed.data;
    if (leadId) await assertLeadAccess(leadId, session);

    const data: Prisma.SiteAuditUncheckedUpdateInput = {};
    if (status !== undefined) {
      data.status = status;
      if (status !== "NEW" && !audit.sentAt) data.sentAt = new Date();
      if (status === "NEW") data.sentAt = null;
    }
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (leadId !== undefined) data.leadId = leadId;
    if (videoScript) {
      // Edits made in the video studio are kept with the audit.
      const report = audit.report as unknown as AuditReport;
      data.report = { ...report, videoScript } as unknown as Prisma.InputJsonValue;
    }

    const updated = await prisma.siteAudit.update({ where: { id: audit.id }, data, select: AUDIT_SUMMARY_SELECT });
    return NextResponse.json({ audit: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const audit = await getAuditOr404(id, session);
    // Reps can delete their own audits; admins can delete any.
    if (session.user.role !== "ADMIN" && audit.createdById !== session.user.id) throw new ApiError(403, "Only the person who ran this audit can delete it");
    await prisma.siteAudit.delete({ where: { id: audit.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
