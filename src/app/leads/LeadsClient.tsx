"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { fetcher } from "@/lib/fetcher";
import { formatCurrency, relativeTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { LeadListItem, TeamMember } from "@/types/models";

export default function LeadsClient({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (assignedToId) params.set("assignedToId", assignedToId);
  if (search) params.set("search", search);

  const { data, isLoading } = useSWR<{ leads: LeadListItem[] }>(
    `/api/leads?${params.toString()}`,
    fetcher
  );
  const { data: teamData } = useSWR<{ users: TeamMember[] }>(
    isAdmin ? "/api/users" : null,
    fetcher
  );

  const leads = data?.leads || [];
  const reps = (teamData?.users || []).filter((u) => u.role === "SALES_REP" && u.active);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{isAdmin ? "All Leads" : "My Leads"}</h1>
        {isAdmin && (
          <Link
            href="/leads/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + New Lead
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, phone…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Everyone</option>
            <option value="unassigned">Unassigned</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading leads…</p>}
      {!isLoading && leads.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No leads found.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{lead.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {lead.company || "—"} {lead.phone ? `· ${lead.phone}` : ""}
                </p>
              </div>
              <StatusBadge status={lead.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{formatCurrency(lead.value)}</span>
              <span>{lead.assignedTo ? `👤 ${lead.assignedTo.name}` : "Unassigned"}</span>
              <span>{lead._count.activities} activity log entries</span>
              {lead._count.followUps > 0 && (
                <span className="text-amber-600">⏰ {lead._count.followUps} open follow-up{lead._count.followUps > 1 ? "s" : ""}</span>
              )}
              <span className="ml-auto">Updated {relativeTime(lead.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
