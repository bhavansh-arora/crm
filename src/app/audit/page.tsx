import AppShell from "@/components/AppShell";
import AuditClient from "./AuditClient";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <AppShell>
      <AuditClient initialUrl={url ?? ""} />
    </AppShell>
  );
}
