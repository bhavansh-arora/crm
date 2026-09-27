import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPaymentReceiptEmail } from "@/lib/mail";
import { createInvoiceFromRazorpayPayment } from "@/lib/invoices";
import type { RazorpayPayment } from "@/lib/razorpay";

// Configure this URL in Razorpay Dashboard → Settings → Webhooks, with the
// "payment_link.paid" event enabled, and set RAZORPAY_WEBHOOK_SECRET to the
// same secret you enter there. Falls back to the manual "Check status"
// button on a payment link if this isn't configured.
//
// With RAZORPAY_AUTO_INVOICE="true", every captured payment also gets an
// invoice issued automatically -- enable "payment.captured" too (for
// payments that don't come through one of this CRM's payment links, e.g.
// Payment Pages or checkout). Invoicing is idempotent per payment, so
// receiving both events for the same payment only ever issues one invoice.
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

  const payment = event?.payload?.payment?.entity as RazorpayPayment | undefined;
  if (process.env.RAZORPAY_AUTO_INVOICE === "true" && payment?.id && payment.status === "captured") {
    try {
      const leadId = linkEntity?.id
        ? (await prisma.paymentLink.findUnique({ where: { razorpayId: linkEntity.id } }))?.leadId
        : null;
      await createInvoiceFromRazorpayPayment(payment, { leadId });
    } catch (error) {
      // Still ack the webhook -- the payment can be invoiced later from the
      // Invoices page's "Import from Razorpay".
      console.error(`Auto-invoicing Razorpay payment ${payment.id} failed:`, error);
    }
  }

  return NextResponse.json({ received: true });
}
