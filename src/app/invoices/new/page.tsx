import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import { defaultTaxRate } from "@/lib/invoices";
import NewInvoiceForm from "./NewInvoiceForm";

// /invoices/new?leadId=... prefills the customer from that lead.
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/leads");

  const { leadId } = await searchParams;
  const lead = leadId
    ? await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, contactName: true, email: true, phone: true, value: true },
      })
    : null;

  return (
    <AppShell>
      <NewInvoiceForm defaultTaxRate={defaultTaxRate()} lead={lead} />
    </AppShell>
  );
}
