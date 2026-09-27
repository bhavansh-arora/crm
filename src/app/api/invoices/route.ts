import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { createInvoice, invoiceErrorResponse, listInvoicesWhere } from "@/lib/invoices";

// ?month=2026-09 | ?fy=2026-27, plus optional ?status= and ?q= search.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const invoices = await prisma.invoice.findMany({
      where: listInvoicesWhere(req.nextUrl.searchParams),
      orderBy: [{ invoiceDate: "desc" }, { sequence: "desc" }],
      take: 500,
      include: { lead: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ invoices });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const invoice = await createInvoice(await req.json(), { source: "MANUAL", createdById: session.user.id });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return invoiceErrorResponse(error);
  }
}
