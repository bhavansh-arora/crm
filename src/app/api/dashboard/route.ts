import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";
import { LEAD_STATUSES, type LeadStatusValue } from "@/lib/constants";

export async function GET() {
  try {
    await requireAdmin();

    const leads = await prisma.lead.findMany({
      select: {
        id: true,
        value: true,
        status: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true } },
        createdAt: true,
        statusChangedAt: true,
        closedAt: true,
      },
    });

    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    const byStatus: Record<LeadStatusValue, { count: number; value: number }> = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, { count: 0, value: 0 }])
    ) as Record<LeadStatusValue, { count: number; value: number }>;

    const avgAgeInStageDays: Record<LeadStatusValue, number> = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, 0])
    ) as Record<LeadStatusValue, number>;
    const stageAgeAccumulator: Record<LeadStatusValue, number[]> = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, [] as number[]])
    ) as Record<LeadStatusValue, number[]>;

    const repMap = new Map<
      string,
      { id: string; name: string; totalLeads: number; wonLeads: number; revenue: number; pipelineValue: number }
    >();

    let totalRevenue = 0;
    let pipelineValue = 0;
    const closeDurations: number[] = [];

    for (const lead of leads) {
      const status = lead.status as LeadStatusValue;
      byStatus[status].count += 1;
      byStatus[status].value += lead.value;

      const ageDays = (now - new Date(lead.statusChangedAt).getTime()) / dayMs;
      stageAgeAccumulator[status].push(ageDays);

      if (lead.status === "WON") {
        totalRevenue += lead.value;
        if (lead.closedAt) {
          closeDurations.push(
            (new Date(lead.closedAt).getTime() - new Date(lead.createdAt).getTime()) / dayMs
          );
        }
      } else if (lead.status !== "LOST") {
        pipelineValue += lead.value;
      }

      if (lead.assignedTo) {
        const rep = repMap.get(lead.assignedTo.id) || {
          id: lead.assignedTo.id,
          name: lead.assignedTo.name,
          totalLeads: 0,
          wonLeads: 0,
          revenue: 0,
          pipelineValue: 0,
        };
        rep.totalLeads += 1;
        if (lead.status === "WON") {
          rep.wonLeads += 1;
          rep.revenue += lead.value;
        } else if (lead.status !== "LOST") {
          rep.pipelineValue += lead.value;
        }
        repMap.set(lead.assignedTo.id, rep);
      }
    }

    for (const status of LEAD_STATUSES) {
      const arr = stageAgeAccumulator[status];
      avgAgeInStageDays[status] = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    }

    const totalLeads = leads.length;
    const wonCount = byStatus.WON.count;
    const lostCount = byStatus.LOST.count;
    const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
    const closeRate = wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;
    const avgDealSize = wonCount > 0 ? totalRevenue / wonCount : 0;
    const avgTimeToCloseDays =
      closeDurations.length > 0 ? closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length : 0;

    const upcomingFollowUps = await prisma.followUp.count({
      where: { completed: false, dueAt: { gte: new Date() } },
    });
    const overdueFollowUps = await prisma.followUp.count({
      where: { completed: false, dueAt: { lt: new Date() } },
    });

    return NextResponse.json({
      totalLeads,
      totalRevenue,
      pipelineValue,
      conversionRate,
      closeRate,
      avgDealSize,
      avgTimeToCloseDays,
      byStatus,
      avgAgeInStageDays,
      reps: Array.from(repMap.values()).sort((a, b) => b.revenue - a.revenue),
      overdueFollowUps,
      upcomingFollowUps,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
