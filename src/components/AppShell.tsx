import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Nav from "@/components/Nav";
import FollowUpNotifications from "@/components/FollowUpNotifications";
import HeartbeatPing from "@/components/HeartbeatPing";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Nav name={session.user.name ?? session.user.email ?? "User"} role={session.user.role} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <HeartbeatPing />
        <FollowUpNotifications />
        {children}
      </main>
    </div>
  );
}
