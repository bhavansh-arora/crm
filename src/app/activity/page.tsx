import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ActivityClient from "./ActivityClient";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/leads");

  return (
    <AppShell>
      <ActivityClient />
    </AppShell>
  );
}
