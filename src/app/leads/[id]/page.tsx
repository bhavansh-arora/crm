import AppShell from "@/components/AppShell";
import LeadDetailClient from "./LeadDetailClient";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <LeadDetailClient leadId={id} />
    </AppShell>
  );
}
