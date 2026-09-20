import type { LeadStatusValue, CallOutcomeValue } from "@/lib/constants";

export type UserSummary = {
  id: string;
  name: string;
  email?: string;
};

export type LeadListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  value: number;
  status: LeadStatusValue;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: UserSummary | null;
  _count: { activities: number; followUps: number };
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

export type LeadDetail = LeadListItem & {
  closedAt: string | null;
  activities: Activity[];
  followUps: FollowUp[];
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SALES_REP";
  active: boolean;
  createdAt: string;
  _count?: { leads: number };
};
