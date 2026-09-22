"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatCurrency, relativeTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import TemperatureBadge from "@/components/TemperatureBadge";
import { CallWhatsAppButtons, CompanyWebsiteEditor } from "@/app/leads/[id]/LeadDetailClient";
import { OPEN_STATUSES, CALL_OUTCOMES, CALL_OUTCOME_LABELS, type CallOutcomeValue } from "@/lib/constants";
import type { LeadListItem } from "@/types/models";

const SORT_OPTIONS = [
  { value: "stale_first", label: "Longest since status change" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "value_desc", label: "Highest value" },
] as const;

const QUICK_FILTERS = [
  { value: "", label: "All" },
  { value: "due_today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "stale", label: "Status Stale" },
] as const;

export default function DialerClient() {
  const [sort, setSort] = useState<string>("stale_first");
  const [filter, setFilter] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const { data, isLoading, mutate } = useSWR<{ leads: LeadListItem[] }>(
    `/api/leads?sort=${sort}${filter ? `&filter=${filter}` : ""}`,
    fetcher
  );
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<CallOutcomeValue | "">("");
  const [note, setNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLeads = (data?.leads || []).filter((l) => (OPEN_STATUSES as string[]).includes(l.status));
  const sources = Array.from(new Set(openLeads.map((l) => l.source).filter((s): s is string => !!s))).sort();
  const queue = source ? openLeads.filter((l) => l.source === source) : openLeads;
  const current = queue[index];

  function resetForm() {
    setOutcome("");
    setNote("");
    setFollowUpDate("");
    setFollowUpNote("");
    setError(null);
  }

  function next() {
    resetForm();
    setIndex((i) => i + 1);
  }

  async function logAndNext() {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      if (outcome) {
        await apiRequest(`/api/leads/${current.id}/activities`, "POST", {
          type: "CALL",
          callOutcome: outcome,
          note: note.trim() || undefined,
        });
      } else if (note.trim()) {
        await apiRequest(`/api/leads/${current.id}/activities`, "POST", {
          type: "NOTE",
          note: note.trim(),
        });
      }
      if (followUpDate) {
        await apiRequest(`/api/leads/${current.id}/followups`, "POST", {
          dueAt: new Date(followUpDate).toISOString(),
          note: followUpNote.trim() || undefined,
        });
      }
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading your call queue…</p>;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Dialer</h1>
        {current && (
          <span className="text-sm text-slate-500">
            {index + 1} of {queue.length}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setIndex(0);
              resetForm();
            }}
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

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setIndex(0);
            resetForm();
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">All lead sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setIndex(0);
            resetForm();
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              Order: {s.label}
            </option>
          ))}
        </select>
      </div>

      {!current ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-4xl">🎉</p>
          <p className="mt-2 text-slate-600">All caught up — no open leads left to call.</p>
          <button
            onClick={() => {
              setIndex(0);
              mutate();
            }}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Refresh queue
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/leads/${current.id}`} className="font-semibold text-slate-900 hover:underline">
                  {current.name}
                </Link>
                <CompanyWebsiteEditor
                  leadId={current.id}
                  contactName={current.contactName}
                  company={current.company}
                  website={current.website}
                  busy={saving}
                  onSaved={(res) => {
                    mutate((prev) => {
                      if (!prev) return prev;
                      return {
                        leads: prev.leads.map((l) =>
                          l.id === current.id
                            ? {
                                ...l,
                                contactName: res.lead.contactName,
                                company: res.lead.company,
                                website: res.lead.website,
                              }
                            : l
                        ),
                      };
                    }, { revalidate: false });
                  }}
                  onError={setError}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <TemperatureBadge temperature={current.temperature} />
                <StatusBadge status={current.status} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{formatCurrency(current.value)}</span>
              <span>Updated {relativeTime(current.updatedAt)}</span>
            </div>

            {current.phone ? (
              <div className="mt-4">
                <CallWhatsAppButtons
                  phone={current.phone}
                  contactName={current.contactName}
                  leadName={current.name}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-amber-600">No phone number on file for this lead.</p>
            )}

            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Call outcome</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as CallOutcomeValue | "")}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Didn&apos;t log a call outcome</option>
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {CALL_OUTCOME_LABELS[o]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="What happened on the call…"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Set a follow-up (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Follow-up note</label>
                  <input
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="e.g. Call back after lunch"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={logAndNext}
                disabled={saving}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & Next Lead"}
              </button>
              <button
                onClick={next}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                Skip
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
