import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { isInvoicesHost } from "@/lib/invoices-host";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (isInvoicesHost((await headers()).get("host"))) redirect("/invoices");
  if (session.user.role === "ADMIN") redirect("/dashboard");
  redirect("/leads");
}
