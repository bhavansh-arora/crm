import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, type LeadStatusValue } from "@/lib/constants";

export default function StatusBadge({ status }: { status: LeadStatusValue }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${LEAD_STATUS_COLORS[status]}`}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
