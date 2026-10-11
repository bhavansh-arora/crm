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

// Fires the moment a rep generates a payment link, before any money has
// moved -- separate from sendPaymentReceiptEmail below, which only fires
// once the link is actually paid. Without this, admins had no way to know
// a link existed until a customer had already paid it.
export async function sendPaymentLinkCreatedEmail(paymentLink: {
  amount: number;
  shortUrl: string;
  description: string | null;
  lead: { name: string; company: string | null };
  createdBy: { name: string } | null;
}): Promise<void> {
  if (!isMailConfigured()) {
    console.log(`Payment link created for "${paymentLink.lead.name}" but SMTP isn't configured — skipping notification`);
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { email: true },
  });

  // Admins only -- the rep who just created it already knows.
  const recipients = new Set(admins.map((a) => a.email));
  if (recipients.size === 0) return;

  const amountFormatted = formatCurrency(paymentLink.amount);
  const subject = `New payment link created: ${amountFormatted} — ${paymentLink.lead.name}`;
  const text = [
    `${paymentLink.createdBy?.name || "A team member"} just created a new payment link.`,
    "",
    `Lead: ${paymentLink.lead.name}${paymentLink.lead.company ? ` (${paymentLink.lead.company})` : ""}`,
    `Amount: ${amountFormatted}`,
    `Description: ${paymentLink.description || "-"}`,
    `Payment link: ${paymentLink.shortUrl}`,
    `Created by: ${paymentLink.createdBy?.name || "Unknown"}`,
  ].join("\n");

  await Promise.all([...recipients].map((to) => sendMail({ to, subject, text })));
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
