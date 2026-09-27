import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import AuditsClient from "./AuditsClient";

export default async function AuditsPage() {
  const session = await getServerSession(authOptions);
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-slate-500">Loading audits…</p>}>
        <AuditsClient isAdmin={session?.user.role === "ADMIN"} />
      </Suspense>
    </AppShell>
  );
}
