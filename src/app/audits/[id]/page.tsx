import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import AuditClient from "../../audit/AuditClient";
import { AUDIT_SUMMARY_SELECT, auditAccessWhere } from "@/lib/site-audit/store";
import type { AuditReport } from "@/lib/site-audit/types";
import type { SavedAudit } from "../AuditManageBar";

export default async function SavedAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { id } = await params;
  const row = await prisma.siteAudit.findFirst({
    where: { AND: [{ id }, auditAccessWhere(session)] },
    select: { ...AUDIT_SUMMARY_SELECT, report: true },
  });
  if (!row) notFound();
  const { report, ...summary } = row;
  const audit: SavedAudit = JSON.parse(JSON.stringify(summary));
  return (
    <AppShell>
      <AuditClient key={row.id} initialUrl={row.url} saved={{ audit, report: report as unknown as AuditReport }} />
    </AppShell>
  );
}
