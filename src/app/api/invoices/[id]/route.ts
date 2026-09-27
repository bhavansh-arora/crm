import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ApiError } from "@/lib/api-auth";
import { invoiceErrorResponse, setInvoiceStatus } from "@/lib/invoices";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    return NextResponse.json({ invoice });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}

// Issued invoices are never edited or deleted -- only marked paid/unpaid or
// cancelled, so every number stays accounted for in the registers.
const patchSchema = z.object({ status: z.enum(["PAID", "UNPAID", "CANCELLED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { status } = patchSchema.parse(await req.json());
    const invoice = await setInvoiceStatus(id, status);
    return NextResponse.json({ invoice });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
