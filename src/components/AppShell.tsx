import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import Nav from "@/components/Nav";
import FollowUpNotifications from "@/components/FollowUpNotifications";
import HeartbeatPing from "@/components/HeartbeatPing";
import { isInvoicesHost } from "@/lib/invoices-host";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const invoicesSite = isInvoicesHost((await headers()).get("host"));

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Nav
        name={session.user.name ?? session.user.email ?? "User"}
        role={session.user.role}
        invoicesSite={invoicesSite}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <HeartbeatPing />
        {!invoicesSite && <FollowUpNotifications />}
        {children}
      </main>
    </div>
  );
}
