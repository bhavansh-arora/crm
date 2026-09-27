import AppShell from "@/components/AppShell";
import AuditClient from "./AuditClient";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ url?: string; leadId?: string }> }) {
  const { url, leadId } = await searchParams;
  return (
    <AppShell>
      <AuditClient initialUrl={url ?? ""} leadId={leadId} />
    </AppShell>
  );
}
