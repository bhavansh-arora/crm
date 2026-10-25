import type { Lead } from "@prisma/client";
import { LEAD_STATUS_LABELS, LEAD_TEMPERATURE_LABELS, type LeadStatusValue, type LeadTemperatureValue } from "@/lib/constants";

type LeadWithAssignee = Lead & { assignedTo: { name: string } | null };

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(leads: LeadWithAssignee[]): string {
  const header = [
    "Name",
    "Contact Name",
    "Company",
    "Email",
    "Phone",
    "Website",
    "Source",
    "Status",
    "Temperature",
    "Value",
    "Assigned To",
    "Created At",
    "Status Changed At",
    "Closed At",
  ];
  const rows = leads.map((l) => [
    l.name,
    l.contactName,
    l.company,
    l.email,
    l.phone,
    l.website,
    l.source,
    LEAD_STATUS_LABELS[l.status as LeadStatusValue] || l.status,
    l.temperature ? LEAD_TEMPERATURE_LABELS[l.temperature as LeadTemperatureValue] : "",
    l.value,
    l.assignedTo?.name || "",
    l.createdAt.toISOString(),
    l.statusChangedAt.toISOString(),
    l.closedAt ? l.closedAt.toISOString() : "",
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
