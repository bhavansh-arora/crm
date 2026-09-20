import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";

const RANGE_MS: Record<string, number> = {
  today: 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

// Largest number of events found in any rolling window of `windowMs`,
// scanning a sorted list of timestamps with a two-pointer sliding window.
function maxBurst(sortedTimesMs: number[], windowMs: number): number {
  let left = 0;
  let max = 0;
  for (let right = 0; right < sortedTimesMs.length; right++) {
    while (sortedTimesMs[right] - sortedTimesMs[left] > windowMs) left++;
    max = Math.max(max, right - left + 1);
  }
  return max;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "today";
    const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS.today));
    const now = Date.now();

    const reps = await prisma.user.findMany({
      where: { role: "SALES_REP" },
      select: { id: true, name: true, email: true, active: true, lastActiveAt: true },
      orderBy: { name: "asc" },
    });

    const activities = await prisma.activity.findMany({
      where: { createdAt: { gte: since }, userId: { in: reps.map((r) => r.id) } },
      select: { userId: true, type: true, createdAt: true },
    });

    const report = reps.map((rep) => {
      const repActivities = activities.filter((a) => a.userId === rep.id);
      const statusChangeTimes = repActivities
        .filter((a) => a.type === "STATUS_CHANGE")
        .map((a) => a.createdAt.getTime())
        .sort((a, b) => a - b);

      return {
        id: rep.id,
        name: rep.name,
        email: rep.email,
        active: rep.active,
        lastActiveAt: rep.lastActiveAt,
        onlineNow: rep.lastActiveAt ? now - rep.lastActiveAt.getTime() < ONLINE_THRESHOLD_MS : false,
        totalActivities: repActivities.length,
        statusChanges: statusChangeTimes.length,
        notes: repActivities.filter((a) => a.type === "NOTE").length,
        calls: repActivities.filter((a) => a.type === "CALL").length,
        maxStatusChangesIn1Min: maxBurst(statusChangeTimes, 60 * 1000),
        maxStatusChangesIn5Min: maxBurst(statusChangeTimes, 5 * 60 * 1000),
        maxStatusChangesIn10Min: maxBurst(statusChangeTimes, 10 * 60 * 1000),
      };
    });

    return NextResponse.json({ range, since, reps: report });
  } catch (error) {
    return handleApiError(error);
  }
}
