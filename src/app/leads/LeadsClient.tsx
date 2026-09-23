"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatCurrency, formatDateTime, relativeTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import TemperatureBadge from "@/components/TemperatureBadge";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_TEMPERATURES, LEAD_TEMPERATURE_LABELS } from "@/lib/constants";
import type { LeadListItem, TeamMember } from "@/types/models";

const QUICK_FILTERS = [
  { value: "", label: "All" },
  { value: "due_today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "stale", label: "Status Stale" },
] as const;

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "value_desc", label: "Highest value" },
  { value: "stale_first", label: "Longest since status change" },
  { value: "source_asc", label: "Lead source" },
] as const;

export default function LeadsClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters/sort live in the URL (not local state) so that clicking into a
  // lead and going back restores exactly what was set, instead of resetting
  // to defaults on remount.
  const status = searchParams.get("status") || "";
  const temperature = searchParams.get("temperature") || "";
  const assignedToId = searchParams.get("assignedToId") || "";
  const source = searchParams.get("source") || "";
  const search = searchParams.get("search") || "";
  const filter = searchParams.get("filter") || "";
  const sort = searchParams.get("sort") || "updated_desc";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const { data, isLoading, mutate } = useSWR<{ leads: LeadListItem[] }>(
    `/api/leads?${searchParams.toString()}`,
    fetcher
  );
  const { data: teamData } = useSWR<{ users: TeamMember[] }>(
    isAdmin ? "/api/users" : null,
    fetcher
  );
  // Unfiltered, so the source dropdown's own option list doesn't shrink to
  // just the currently-selected source once that filter is applied.
  const { data: allLeadsData } = useSWR<{ leads: LeadListItem[] }>("/api/leads", fetcher);

  const leads = data?.leads || [];
  const reps = (teamData?.users || []).filter((u) => u.role === "SALES_REP" && u.active);
  const sourceCounts = new Map<string, number>();
  for (const l of allLeadsData?.leads || []) {
    if (!l.source) continue;
    sourceCounts.set(l.source, (sourceCounts.get(l.source) || 0) + 1);
  }
  const sources = Array.from(sourceCounts.keys()).sort();

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));
  }

  async function bulkAssign() {
    setBulkBusy(true);
    setBulkError(null);
    try {
      await apiRequest("/api/leads/bulk-assign", "PATCH", {
        leadIds: [...selected],
        assignedToId: bulkAssignee || null,
      });
      setSelected(new Set());
      setBulkAssignee("");
      mutate();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to assign leads");
    } finally {
      setBulkBusy(false);
    }
  }

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

      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => updateParam("filter", f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
              filter === f.value
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          value={search}
          onChange={(e) => updateParam("search", e.target.value)}
          placeholder="Search by name, company, phone…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => updateParam("status", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={temperature}
          onChange={(e) => updateParam("temperature", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Any temperature</option>
          {LEAD_TEMPERATURES.map((t) => (
            <option key={t} value={t}>
              {LEAD_TEMPERATURE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => updateParam("source", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All lead sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s} ({sourceCounts.get(s)})
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={assignedToId}
            onChange={(e) => updateParam("assignedToId", e.target.value)}
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
        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      {isAdmin && leads.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size === leads.length}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-slate-600">
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
          </label>
          {selected.size > 0 && (
            <>
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Unassign</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                onClick={bulkAssign}
                disabled={bulkBusy}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {bulkBusy ? "Assigning…" : `Assign ${selected.size} lead${selected.size === 1 ? "" : "s"}`}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
            </>
          )}
          {bulkError && <span className="text-xs text-rose-600">{bulkError}</span>}
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading leads…</p>}
      {!isLoading && leads.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No leads found.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {leads.map((lead) => {
          const nextFollowUp = lead.followUps[0];
          const overdue = nextFollowUp && new Date(nextFollowUp.dueAt).getTime() < Date.now();
          return (
            <div key={lead.id} className="flex items-start gap-2">
              {isAdmin && (
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggleSelected(lead.id)}
                  className="mt-4 h-4 w-4 shrink-0 rounded border-slate-300"
                />
              )}
              <Link
                href={`/leads/${lead.id}`}
                className="block flex-1 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{lead.name}</p>
                    <p className="truncate text-sm text-slate-500">
                      {lead.company || "—"} {lead.phone ? `· ${lead.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TemperatureBadge temperature={lead.temperature} />
                    <StatusBadge status={lead.status} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{formatCurrency(lead.value)}</span>
                  <span>{lead.assignedTo ? `👤 ${lead.assignedTo.name}` : "Unassigned"}</span>
                  {lead.source && <span>📌 {lead.source}</span>}
                  <span>{lead._count.activities} activity log entries</span>
                  {nextFollowUp && (
                    <span className={overdue ? "font-medium text-rose-600" : "text-amber-600"}>
                      ⏰ {overdue ? "Overdue" : "Due"} {formatDateTime(nextFollowUp.dueAt)}
                      {lead._count.followUps > 1 ? ` (+${lead._count.followUps - 1} more)` : ""}
                    </span>
                  )}
                  <span className="ml-auto">Updated {relativeTime(lead.updatedAt)}</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
