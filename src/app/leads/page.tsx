import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading leads…</p>}>
        <LeadsClient isAdmin={session?.user.role === "ADMIN"} />
      </Suspense>
    </AppShell>
  );
}
