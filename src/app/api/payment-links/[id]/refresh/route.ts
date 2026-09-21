import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";
import { getPaymentLink } from "@/lib/razorpay";
import { sendPaymentReceiptEmail } from "@/lib/mail";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!paymentLink) throw new ApiError(404, "Payment link not found");
    if (session.user.role === "SALES_REP" && paymentLink.lead.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    const rzpLink = await getPaymentLink(paymentLink.razorpayId);
    const status = rzpLink.status.toUpperCase();
    const wasPaid = paymentLink.status === "PAID";

    const updated = await prisma.paymentLink.update({
      where: { id },
      data: {
        status,
        paidAt: status === "PAID" ? (paymentLink.paidAt ?? new Date()) : paymentLink.paidAt,
      },
      include: {
        lead: { select: { name: true, company: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (status === "PAID" && !wasPaid) {
      await sendPaymentReceiptEmail(updated);
    }

    return NextResponse.json({ paymentLink: updated });
  } catch (error) {
    if (error instanceof Error && !(error instanceof ApiError)) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleApiError(error);
  }
}
