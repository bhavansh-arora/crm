import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  return (
    <AppShell>
      <LeadsClient isAdmin={session?.user.role === "ADMIN"} />
    </AppShell>
  );
}
