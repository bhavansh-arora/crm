import type {
  LeadStatusValue,
  CallOutcomeValue,
  LeadTemperatureValue,
  PaymentLinkStatusValue,
} from "@/lib/constants";

export type UserSummary = {
  id: string;
  name: string;
  email?: string;
  lastActiveAt?: string | null;
};

export type WhatsAppTemplate = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  createdBy: UserSummary | null;
};

export type LeadListItem = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  source: string | null;
  value: number;
  status: LeadStatusValue;
  temperature: LeadTemperatureValue | null;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: UserSummary | null;
  _count: { activities: number; followUps: number };
  followUps: { id: string; dueAt: string }[];
};

export type Activity = {
  id: string;
  type: "NOTE" | "CALL" | "STATUS_CHANGE";
  note: string | null;
  callNumber: number | null;
  callOutcome: CallOutcomeValue | null;
  fromStatus: LeadStatusValue | null;
  toStatus: LeadStatusValue | null;
  createdAt: string;
  user: UserSummary | null;
};

export type FollowUp = {
  id: string;
  leadId: string;
  dueAt: string;
  note: string | null;
  completed: boolean;
  createdAt: string;
  user: UserSummary | null;
  lead?: {
    id: string;
    name: string;
    company: string | null;
    status: LeadStatusValue;
    assignedToId: string | null;
    assignedTo: { name: string } | null;
  };
};

export type PaymentLink = {
  id: string;
  leadId: string;
  razorpayId: string;
  shortUrl: string;
  amount: number;
  description: string | null;
  status: PaymentLinkStatusValue;
  createdAt: string;
  paidAt: string | null;
  createdBy: UserSummary | null;
};

export type LeadDetail = Omit<LeadListItem, "followUps"> & {
  closedAt: string | null;
  activities: Activity[];
  followUps: FollowUp[];
  paymentLinks: PaymentLink[];
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SALES_REP";
  active: boolean;
  createdAt: string;
  lastActiveAt?: string | null;
  _count?: { leads: number };
};

export type LeadSource = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
};
