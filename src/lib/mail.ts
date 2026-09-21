import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

export async function sendMail(opts: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!isMailConfigured()) return false;
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || "CRM Reminders <reminders@example.com>",
      ...opts,
    });
    return true;
  } catch (err) {
    console.error("Failed to send email", err);
    return false;
  }
}

export async function sendPaymentReceiptEmail(paymentLink: {
  amount: number;
  shortUrl: string;
  description: string | null;
  paidAt: Date | null;
  lead: { name: string; company: string | null };
  createdBy: { name: string; email: string } | null;
}): Promise<void> {
  if (!isMailConfigured()) {
    console.log(`Payment received for "${paymentLink.lead.name}" but SMTP isn't configured — skipping receipt email`);
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { email: true },
  });

  const recipients = new Set<string>();
  if (paymentLink.createdBy?.email) recipients.add(paymentLink.createdBy.email);
  for (const admin of admins) recipients.add(admin.email);
  if (recipients.size === 0) return;

  const amountFormatted = formatCurrency(paymentLink.amount);
  const paidAt = paymentLink.paidAt ?? new Date();
  const subject = `Payment received: ${amountFormatted} — ${paymentLink.lead.name}`;
  const text = [
    "A payment has been received.",
    "",
    `Lead: ${paymentLink.lead.name}${paymentLink.lead.company ? ` (${paymentLink.lead.company})` : ""}`,
    `Amount: ${amountFormatted}`,
    `Description: ${paymentLink.description || "-"}`,
    `Paid at: ${paidAt.toLocaleString("en-IN")}`,
    `Payment link: ${paymentLink.shortUrl}`,
    `Collected by: ${paymentLink.createdBy?.name || "Unknown"}`,
  ].join("\n");

  await Promise.all([...recipients].map((to) => sendMail({ to, subject, text })));
}
