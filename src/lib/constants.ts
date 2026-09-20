export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const LEAD_STATUS_COLORS: Record<LeadStatusValue, string> = {
  NEW: "bg-slate-100 text-slate-700 ring-slate-300",
  CONTACTED: "bg-blue-100 text-blue-700 ring-blue-300",
  QUALIFIED: "bg-indigo-100 text-indigo-700 ring-indigo-300",
  PROPOSAL: "bg-amber-100 text-amber-700 ring-amber-300",
  NEGOTIATION: "bg-purple-100 text-purple-700 ring-purple-300",
  WON: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  LOST: "bg-rose-100 text-rose-700 ring-rose-300",
};

export const OPEN_STATUSES: LeadStatusValue[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
];

export const CALL_OUTCOMES = [
  "CONNECTED",
  "NOT_CONNECTED",
  "NO_ANSWER",
  "VOICEMAIL",
  "CALLBACK_REQUESTED",
] as const;

export type CallOutcomeValue = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcomeValue, string> = {
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  NO_ANSWER: "No Answer",
  VOICEMAIL: "Left Voicemail",
  CALLBACK_REQUESTED: "Callback Requested",
};

export const CALL_OUTCOME_COLORS: Record<CallOutcomeValue, string> = {
  CONNECTED: "bg-emerald-100 text-emerald-700",
  NOT_CONNECTED: "bg-rose-100 text-rose-700",
  NO_ANSWER: "bg-amber-100 text-amber-700",
  VOICEMAIL: "bg-blue-100 text-blue-700",
  CALLBACK_REQUESTED: "bg-purple-100 text-purple-700",
};

export const LEAD_TEMPERATURES = ["HOT", "WARM", "COLD"] as const;

export type LeadTemperatureValue = (typeof LEAD_TEMPERATURES)[number];

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperatureValue, string> = {
  HOT: "🔥 Hot",
  WARM: "☀️ Warm",
  COLD: "❄️ Cold",
};

export const LEAD_TEMPERATURE_COLORS: Record<LeadTemperatureValue, string> = {
  HOT: "bg-rose-100 text-rose-700 ring-rose-300",
  WARM: "bg-amber-100 text-amber-700 ring-amber-300",
  COLD: "bg-sky-100 text-sky-700 ring-sky-300",
};

export const PAYMENT_LINK_STATUSES = ["CREATED", "PAID", "EXPIRED", "CANCELLED"] as const;
export type PaymentLinkStatusValue = (typeof PAYMENT_LINK_STATUSES)[number];
export const PAYMENT_LINK_STATUS_LABELS: Record<PaymentLinkStatusValue, string> = {
  CREATED: "Awaiting payment",
  PAID: "Paid",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
export const PAYMENT_LINK_STATUS_COLORS: Record<PaymentLinkStatusValue, string> = {
  CREATED: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-rose-100 text-rose-700",
};
