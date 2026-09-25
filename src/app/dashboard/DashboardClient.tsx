"use client";

import useSWR from "swr";
import Link from "next/link";
import { fetcher } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/format";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_TEMPERATURES,
  LEAD_TEMPERATURE_LABELS,
  type LeadStatusValue,
  type LeadTemperatureValue,
} from "@/lib/constants";

type DashboardStats = {
  totalLeads: number;
  totalRevenue: number;
  pipelineValue: number;
  warmPipelineValue: number;
  conversionRate: number;
  closeRate: number;
  avgDealSize: number;
  avgTimeToCloseDays: number;
  byStatus: Record<LeadStatusValue, { count: number; value: number }>;
  byTemperature: Record<LeadTemperatureValue, number>;
  avgAgeInStageDays: Record<LeadStatusValue, number>;
  reps: {
    id: string;
    name: string;
    totalLeads: number;
    wonLeads: number;
    revenue: number;
    pipelineValue: number;
    uncontactedLeads: number;
  }[];
  overdueFollowUps: number;
  upcomingFollowUps: number;
  dueTodayFollowUps: number;
  newLeadsToday: number;
  unassignedUncontactedLeads: number;
};

export default function DashboardClient() {
  const { data, isLoading } = useSWR<DashboardStats>("/api/dashboard", fetcher);

  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  const maxStatusCount = Math.max(1, ...LEAD_STATUSES.map((s) => data.byStatus[s].count));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Revenue Won" value={formatCurrency(data.totalRevenue)} accent="emerald" />
        <StatCard label="Pipeline Value" value={formatCurrency(data.pipelineValue)} accent="blue" />
        <StatCard label="Warm Pipeline" value={formatCurrency(data.warmPipelineValue)} accent="orange" />
        <StatCard label="Conversion Rate" value={`${data.conversionRate.toFixed(1)}%`} accent="indigo" />
        <StatCard label="Avg Deal Size" value={formatCurrency(data.avgDealSize)} accent="amber" />
        <StatCard label="Avg Time to Close" value={`${data.avgTimeToCloseDays.toFixed(1)}d`} accent="purple" />
      </div>

      {data.unassignedUncontactedLeads > 0 && (
        <Link
          href="/leads?assignedToId=unassigned&status=NEW"
          className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100 hover:ring-amber-300"
        >
          <span className="font-medium">🆕 New, uncontacted, and unassigned</span>
          <span>
            {data.unassignedUncontactedLeads} lead{data.unassignedUncontactedLeads !== 1 ? "s" : ""} waiting
            to be assigned to a rep →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(data.overdueFollowUps > 0 || data.upcomingFollowUps > 0) && (
          <Link
            href="/followups"
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand-300"
          >
            <span className="text-sm font-medium text-slate-700">⏰ Follow-ups</span>
            <span className="text-sm text-slate-500">
              {data.overdueFollowUps > 0 && <span className="mr-3 font-semibold text-rose-600">{data.overdueFollowUps} overdue</span>}
              <span className="mr-3">{data.dueTodayFollowUps} due today</span>
              {data.upcomingFollowUps} upcoming
            </span>
          </Link>
        )}

        <Link
          href="/activity"
          className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand-300"
        >
          <span className="text-sm font-medium text-slate-700">📈 Team activity</span>
          <span className="text-sm text-slate-500">
            {data.newLeadsToday} new lead{data.newLeadsToday !== 1 ? "s" : ""} today
          </span>
        </Link>
      </div>

      {/* Temperature breakdown */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold text-slate-900">Leads by Temperature</h2>
        <div className="grid grid-cols-3 gap-3">
          {LEAD_TEMPERATURES.map((t) => (
            <div key={t} className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-lg font-semibold text-slate-800">{data.byTemperature[t]}</p>
              <p className="text-xs text-slate-500">{LEAD_TEMPERATURE_LABELS[t]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold text-slate-900">Pipeline by Stage</h2>
        <div className="space-y-3">
          {LEAD_STATUSES.map((status) => {
            const stat = data.byStatus[status];
            const widthPct = (stat.count / maxStatusCount) * 100;
            return (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{LEAD_STATUS_LABELS[status]}</span>
                  <span className="text-slate-500">
                    {stat.count} lead{stat.count !== 1 ? "s" : ""} · {formatCurrency(stat.value)} · avg{" "}
                    {data.avgAgeInStageDays[status].toFixed(1)}d in stage
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${barColor(status)}`}
                    style={{ width: `${Math.max(widthPct, stat.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue by rep */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 font-semibold text-slate-900">Revenue by Sales Rep</h2>
        {data.reps.length === 0 && <p className="text-sm text-slate-400">No leads assigned yet.</p>}
        <div className="space-y-3">
          {data.reps.map((rep) => {
            const maxRevenue = Math.max(1, ...data.reps.map((r) => r.revenue));
            const conversionForRep = rep.totalLeads > 0 ? (rep.wonLeads / rep.totalLeads) * 100 : 0;
            return (
              <div key={rep.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{rep.name}</span>
                  <span className="text-slate-500">
                    {formatCurrency(rep.revenue)} won · {rep.wonLeads}/{rep.totalLeads} leads (
                    {conversionForRep.toFixed(0)}%) · {formatCurrency(rep.pipelineValue)} in pipeline
                    {rep.uncontactedLeads > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium text-amber-600">
                          {rep.uncontactedLeads} new, uncontacted
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.max((rep.revenue / maxRevenue) * 100, rep.revenue > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function barColor(status: LeadStatusValue) {
  const map: Record<LeadStatusValue, string> = {
    NEW: "bg-slate-400",
    CONTACTED: "bg-blue-500",
    QUALIFIED: "bg-indigo-500",
    PROPOSAL: "bg-amber-500",
    NEGOTIATION: "bg-purple-500",
    WON: "bg-emerald-500",
    LOST: "bg-rose-400",
  };
  return map[status];
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const accentMap: Record<string, string> = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    orange: "text-orange-600",
    indigo: "text-indigo-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
  };
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accentMap[accent] || "text-slate-900"}`}>{value}</p>
    </div>
  );
}
