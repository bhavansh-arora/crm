import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-auth";

const RANGE_MS: Record<string, number> = {
  today: 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

// A gap longer than this between consecutive pings means the tab was closed
// or the app went to the background -- treat it as the end of one session
// and the start of the next, rather than one continuous stretch.
const SESSION_GAP_MS = 3 * 60 * 1000;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Reps and admin are India-based, but the server (and Postgres) run in UTC --
// bucket by the IST calendar date so "today" and day boundaries match what
// the admin actually expects, regardless of the server's own timezone.
function istDateKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

type Session = { start: string; end: string; minutes: number };
type DayEntry = { date: string; totalMinutes: number; sessions: Session[] };

function buildDays(timestamps: Date[]): DayEntry[] {
  const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
  const byDay = new Map<string, Date[]>();
  for (const ts of sorted) {
    const key = istDateKey(ts);
    const arr = byDay.get(key) || [];
    arr.push(ts);
    byDay.set(key, arr);
  }

  const days: DayEntry[] = [];
  for (const [date, pings] of byDay.entries()) {
    const sessions: Session[] = [];
    let sessionStart = pings[0];
    let sessionEnd = pings[0];

    for (let i = 1; i <= pings.length; i++) {
      const ping = pings[i];
      if (ping && ping.getTime() - sessionEnd.getTime() <= SESSION_GAP_MS) {
        sessionEnd = ping;
        continue;
      }
      const minutes = Math.max(1, Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60000));
      sessions.push({ start: sessionStart.toISOString(), end: sessionEnd.toISOString(), minutes });
      if (ping) {
        sessionStart = ping;
        sessionEnd = ping;
      }
    }

    days.push({
      date,
      totalMinutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
      sessions,
    });
  }

  return days.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d";
    const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS["7d"]));

    const reps = await prisma.user.findMany({
      where: { role: "SALES_REP" },
      select: { id: true, name: true, email: true, active: true },
      orderBy: { name: "asc" },
    });

    const logs = await prisma.heartbeatLog.findMany({
      where: { createdAt: { gte: since }, userId: { in: reps.map((r) => r.id) } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const report = reps.map((rep) => ({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      active: rep.active,
      days: buildDays(logs.filter((l) => l.userId === rep.id).map((l) => l.createdAt)),
    }));

    return NextResponse.json({ range, since, reps: report });
  } catch (error) {
    return handleApiError(error);
  }
}
