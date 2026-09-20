import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-auth";

// Pinged periodically by HeartbeatPing while a user has the app open, so
// admins can see who's currently active and when each rep was last seen.
export async function POST() {
  try {
    const session = await requireSession();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
