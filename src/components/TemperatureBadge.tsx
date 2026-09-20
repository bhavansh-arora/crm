import { LEAD_TEMPERATURE_COLORS, LEAD_TEMPERATURE_LABELS, type LeadTemperatureValue } from "@/lib/constants";

export default function TemperatureBadge({ temperature }: { temperature: LeadTemperatureValue | null }) {
  if (!temperature) return null;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${LEAD_TEMPERATURE_COLORS[temperature]}`}
    >
      {LEAD_TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
