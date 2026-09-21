import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/lib/mail";

// Call this endpoint from an external scheduler (e.g. Vercel Cron, a GitHub
// Action, or plain cron + curl) every few minutes. It emails sales reps
// about follow-ups that are now due and haven't been reminded about yet.
// If SMTP_HOST is not configured, it simply reports what it would have sent
// so the in-app "Follow-ups" page remains the source of truth.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueFollowUps = await prisma.followUp.findMany({
    where: {
      completed: false,
      dueAt: { lte: new Date() },
      reminderSentAt: null,
    },
    include: {
      lead: { select: { name: true, company: true } },
      user: { select: { name: true, email: true } },
    },
  });

  const smtpConfigured = isMailConfigured();
  const results: { leadName: string; to: string | null; sent: boolean }[] = [];

  for (const followUp of dueFollowUps) {
    const to = followUp.user?.email ?? null;

    const sent = to
      ? await sendMail({
          to,
          subject: `Follow-up due: ${followUp.lead.name}${followUp.lead.company ? ` (${followUp.lead.company})` : ""}`,
          text: `Reminder: your follow-up for ${followUp.lead.name} is due.\n\nNote: ${followUp.note || "(no note)"}`,
        })
      : false;
    results.push({ leadName: followUp.lead.name, to, sent });

    await prisma.followUp.update({
      where: { id: followUp.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return NextResponse.json({
    smtpConfigured,
    processed: results.length,
    results,
  });
}
