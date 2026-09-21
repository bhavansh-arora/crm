import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPaymentReceiptEmail } from "@/lib/mail";

// Configure this URL in Razorpay Dashboard → Settings → Webhooks, with the
// "payment_link.paid" event enabled, and set RAZORPAY_WEBHOOK_SECRET to the
// same secret you enter there. Falls back to the manual "Check status"
// button on a payment link if this isn't configured.
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 501 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const linkEntity = event?.payload?.payment_link?.entity;

  if (linkEntity?.id) {
    const status = String(linkEntity.status || "").toUpperCase();
    const existing = await prisma.paymentLink.findUnique({ where: { razorpayId: linkEntity.id } });

    if (existing) {
      const updated = await prisma.paymentLink.update({
        where: { id: existing.id },
        data: {
          status,
          paidAt: status === "PAID" ? (existing.paidAt ?? new Date()) : existing.paidAt,
        },
        include: {
          lead: { select: { name: true, company: true } },
          createdBy: { select: { name: true, email: true } },
        },
      });

      if (status === "PAID" && existing.status !== "PAID") {
        await sendPaymentReceiptEmail(updated);
      }
    }
  }

  return NextResponse.json({ received: true });
}
