import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getPublicCompanyDetails } from "@/lib/invoices";
import InvoiceDetailClient from "./InvoiceDetailClient";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/leads");
  const { id } = await params;

  return (
    <AppShell>
      <InvoiceDetailClient id={id} company={getPublicCompanyDetails()} />
    </AppShell>
  );
}
