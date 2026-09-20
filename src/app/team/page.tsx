import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/leads");

  return (
    <AppShell>
      <TeamClient />
    </AppShell>
  );
}
