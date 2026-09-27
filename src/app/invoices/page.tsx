import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { getCompanyDetails } from "@/lib/invoices";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/leads");

  return (
    <AppShell>
      <InvoicesClient
        companyName={getCompanyDetails().name}
        razorpayConfigured={Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)}
      />
    </AppShell>
  );
}
