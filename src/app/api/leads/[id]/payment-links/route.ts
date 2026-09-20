import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, ApiError, handleApiError } from "@/lib/api-auth";
import { createPaymentLink, isRazorpayConfigured } from "@/lib/razorpay";

const createSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().min(1, "Description is required").max(200),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession();

    if (!isRazorpayConfigured()) {
      throw new ApiError(400, "Razorpay isn't set up yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (session.user.role === "SALES_REP" && lead.assignedToId !== session.user.id) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    const rzpLink = await createPaymentLink({
      amountInRupees: data.amount,
      description: data.description,
      referenceId: `${lead.id}-${Date.now()}`,
      customerName: lead.name,
      customerEmail: lead.email || undefined,
      customerPhone: lead.phone || undefined,
    });

    const paymentLink = await prisma.paymentLink.create({
      data: {
        leadId: id,
        createdById: session.user.id,
        razorpayId: rzpLink.id,
        shortUrl: rzpLink.short_url,
        amount: data.amount,
        description: data.description,
        status: rzpLink.status.toUpperCase(),
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ paymentLink }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && !(error instanceof ApiError)) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleApiError(error);
  }
}
