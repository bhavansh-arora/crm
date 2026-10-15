"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Flame,
  Percent,
  DollarSign,
  Timer,
  ArrowRight,
  Clock,
  LineChart,
  FolderKanban,
  Thermometer,
  Trophy,
} from "lucide-react";
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

const TEMPERATURE_STYLES: Record<LeadTemperatureValue, { dot: string; text: string }> = {
  HOT: { dot: "bg-rose-500", text: "text-rose-600" },
  WARM: { dot: "bg-amber-500", text: "text-amber-600" },
  COLD: { dot: "bg-sky-500", text: "text-sky-600" },
};

export default function DashboardClient({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useSWR<DashboardStats>("/api/dashboard", fetcher);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const maxStatusCount = Math.max(1, ...LEAD_STATUSES.map((s) => data.byStatus[s].count));
  const uncontactedCount = isAdmin ? data.unassignedUncontactedLeads : data.byStatus.NEW.count;
  const prefix = isAdmin ? "" : "My ";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {isAdmin ? "Dashboard" : "My Dashboard"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{today} · here&rsquo;s how things are looking</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={`${prefix}Revenue Won`}
          value={formatCurrency(data.totalRevenue)}
          icon={Wallet}
          accent="emerald"
        />
        <StatCard
          label={`${prefix}Pipeline Value`}
          value={formatCurrency(data.pipelineValue)}
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          label="Warm Pipeline"
          value={formatCurrency(data.warmPipelineValue)}
          icon={Flame}
          accent="orange"
        />
        <StatCard
          label="Conversion Rate"
          value={`${data.conversionRate.toFixed(1)}%`}
          icon={Percent}
          accent="indigo"
        />
        <StatCard label="Avg Deal Size" value={formatCurrency(data.avgDealSize)} icon={DollarSign} accent="amber" />
        <StatCard
          label="Avg Time to Close"
          value={`${data.avgTimeToCloseDays.toFixed(1)}d`}
          icon={Timer}
          accent="purple"
        />
      </div>

      {uncontactedCount > 0 && (
        <Link
          href={isAdmin ? "/leads?assignedToId=unassigned&status=NEW" : "/leads?status=NEW"}
          className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 text-sm ring-1 ring-amber-200/70 transition hover:ring-amber-300"
        >
          <span className="flex items-center gap-2 font-medium text-amber-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Flame className="h-4 w-4" strokeWidth={2} />
            </span>
            {isAdmin ? "New, uncontacted, and unassigned" : "New leads in your kitty"}
          </span>
          <span className="flex items-center gap-2 font-medium text-amber-700">
            {uncontactedCount} lead{uncontactedCount !== 1 ? "s" : ""}{" "}
            {isAdmin ? "waiting to be assigned" : "not yet contacted"}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(data.overdueFollowUps > 0 || data.upcomingFollowUps > 0) && (
          <Link
            href="/followups"
            className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Clock className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              Follow-ups
            </span>
            <span className="text-sm text-slate-500">
              {data.overdueFollowUps > 0 && (
                <span className="mr-3 font-semibold text-rose-600">{data.overdueFollowUps} overdue</span>
              )}
              <span className="mr-3">{data.dueTodayFollowUps} due today</span>
              {data.upcomingFollowUps} upcoming
            </span>
          </Link>
        )}

        <Link
          href={isAdmin ? "/activity" : "/leads"}
          className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              {isAdmin ? (
                <LineChart className="h-[18px] w-[18px]" strokeWidth={2} />
              ) : (
                <FolderKanban className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </span>
            {isAdmin ? "Team activity" : "My leads"}
          </span>
          <span className="text-sm text-slate-500">
            {data.newLeadsToday} new lead{data.newLeadsToday !== 1 ? "s" : ""} today
          </span>
        </Link>
      </div>

      {/* Temperature breakdown */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <Thermometer className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />
          Leads by Temperature
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {LEAD_TEMPERATURES.map((t) => (
            <div key={t} className="rounded-xl bg-slate-50 p-4 text-center ring-1 ring-slate-100">
              <p className="text-xl font-semibold text-slate-800">{data.byTemperature[t]}</p>
              <p
                className={`mt-1 flex items-center justify-center gap-1.5 text-xs font-medium ${TEMPERATURE_STYLES[t].text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${TEMPERATURE_STYLES[t].dot}`} />
                {LEAD_TEMPERATURE_LABELS[t]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <FolderKanban className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />
          Pipeline by Stage
        </h2>
        <div className="space-y-4">
          {LEAD_STATUSES.map((status) => {
            const stat = data.byStatus[status];
            const widthPct = (stat.count / maxStatusCount) * 100;
            return (
              <div key={status}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{LEAD_STATUS_LABELS[status]}</span>
                  <span className="text-slate-500">
                    {stat.count} lead{stat.count !== 1 ? "s" : ""} · {formatCurrency(stat.value)} · avg{" "}
                    {data.avgAgeInStageDays[status].toFixed(1)}d in stage
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${barColor(status)} transition-[width]`}
                    style={{ width: `${Math.max(widthPct, stat.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue by rep */}
      {isAdmin && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Trophy className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />
            Revenue by Sales Rep
          </h2>
          {data.reps.length === 0 && <p className="text-sm text-slate-400">No leads assigned yet.</p>}
          <div className="space-y-4">
            {data.reps.map((rep) => {
              const maxRevenue = Math.max(1, ...data.reps.map((r) => r.revenue));
              const conversionForRep = rep.totalLeads > 0 ? (rep.wonLeads / rep.totalLeads) * 100 : 0;
              return (
                <div key={rep.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                        {repInitials(rep.name)}
                      </span>
                      {rep.name}
                    </span>
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
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width]"
                      style={{ width: `${Math.max((rep.revenue / maxRevenue) * 100, rep.revenue > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function repInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?";
  return letters.toUpperCase();
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

const ACCENT_STYLES: Record<string, { icon: string; iconBg: string }> = {
  emerald: { icon: "text-emerald-600", iconBg: "bg-emerald-50" },
  blue: { icon: "text-blue-600", iconBg: "bg-blue-50" },
  orange: { icon: "text-orange-600", iconBg: "bg-orange-50" },
  indigo: { icon: "text-indigo-600", iconBg: "bg-indigo-50" },
  amber: { icon: "text-amber-600", iconBg: "bg-amber-50" },
  purple: { icon: "text-purple-600", iconBg: "bg-purple-50" },
};

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  accent: string;
}) {
  const style = ACCENT_STYLES[accent] ?? ACCENT_STYLES.blue;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${style.iconBg} ${style.icon}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </div>
      <p className="truncate text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
