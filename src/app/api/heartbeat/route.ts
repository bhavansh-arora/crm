import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-auth";

// Throttle: HeartbeatPing fires every 60s, plus an extra ping on every
// visibilitychange (tab switches back and forth), so without this a user
// flipping tabs repeatedly could log several rows within the same minute.
const LOG_THROTTLE_MS = 30_000;

// Pinged periodically by HeartbeatPing while a user has the app open, so
// admins can see who's currently active, when each rep was last seen, and
// (via HeartbeatLog) how much time they've actually spent in the app per day.
export async function POST() {
  try {
    const session = await requireSession();
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lastActiveAt: true },
    });
    const shouldLog =
      !user?.lastActiveAt || now.getTime() - user.lastActiveAt.getTime() > LOG_THROTTLE_MS;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: now },
    });
    if (shouldLog) {
      await prisma.heartbeatLog.create({ data: { userId: session.user.id, createdAt: now } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
