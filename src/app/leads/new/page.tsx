import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import NewLeadForm from "./NewLeadForm";

export default async function NewLeadPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/leads");

  return (
    <AppShell>
      <NewLeadForm />
    </AppShell>
  );
}
