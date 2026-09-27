"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { AUDIT_STATUSES, AUDIT_STATUS_COLORS, AUDIT_STATUS_LABELS, type AuditStatusValue } from "@/lib/constants";

// A saved audit as it reaches the browser (dates serialised to strings).
export type SavedAudit = {
  id: string;
  url: string;
  domain: string;
  pageTitle: string | null;
  score: number;
  grade: string;
  siteType: string;
  verdict: string | null;
  status: string;
  notes: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead: { id: string; name: string; company: string | null } | null;
  createdBy: { id: string; name: string } | null;
};

type LeadOption = { id: string; name: string; company: string | null; website: string | null };

export function formatAuditDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Management strip at the top of a saved audit: outreach status, the lead it
// belongs to, private notes, re-run and delete.
export default function AuditManageBar({ audit: initial }: { audit: SavedAudit }) {
  const router = useRouter();
  const [audit, setAudit] = useState(initial);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [leadQuery, setLeadQuery] = useState(initial.domain.replace(/^www\./, "").replace(/\.[a-z.]+$/, ""));
  const [leadOptions, setLeadOptions] = useState<LeadOption[] | null>(null);

  async function update(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const data = await apiRequest<{ audit: SavedAudit }>(`/api/site-audits/${audit.id}`, "PATCH", patch);
      setAudit(data.audit);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!picking) return;
    const q = leadQuery.trim();
    const t = setTimeout(() => {
      fetcher(`/api/leads?search=${encodeURIComponent(q)}`)
        .then((d: { leads: LeadOption[] }) => setLeadOptions(d.leads.slice(0, 8)))
        .catch(() => setLeadOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [picking, leadQuery]);

  async function remove() {
    if (!confirm(`Delete the audit of ${audit.domain}? This can't be undone.`)) return;
    try {
      await apiRequest(`/api/site-audits/${audit.id}`, "DELETE");
      router.push("/audits");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  const rerunHref = `/audit?url=${encodeURIComponent(audit.url)}${audit.lead ? `&leadId=${audit.lead.id}` : ""}`;

  return (
    <div className="no-print rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href="/audits" className="font-medium text-slate-500 hover:text-slate-800">
          ← All audits
        </Link>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">
          Run {formatAuditDate(audit.createdAt)}
          {audit.createdBy && <> by <span className="font-medium text-slate-700">{audit.createdBy.name}</span></>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <a href={rerunHref} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            ↻ Re-run
          </a>
          <button onClick={remove} className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50">
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr_1.4fr]">
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {AUDIT_STATUSES.map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => audit.status !== s && update({ status: s })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                  audit.status === s ? AUDIT_STATUS_COLORS[s] : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {AUDIT_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {audit.sentAt && audit.status !== "NEW" && <div className="mt-1.5 text-xs text-slate-400">Sent {formatAuditDate(audit.sentAt)}</div>}
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Lead</div>
          {audit.lead && !picking ? (
            <div className="flex items-center gap-2 text-sm">
              <Link href={`/leads/${audit.lead.id}`} className="truncate font-medium text-brand-700 hover:underline">
                {audit.lead.name}
                {audit.lead.company && audit.lead.company !== audit.lead.name && <span className="font-normal text-slate-500"> · {audit.lead.company}</span>}
              </Link>
              <button onClick={() => setPicking(true)} className="shrink-0 text-xs text-slate-500 hover:text-slate-800">
                Change
              </button>
              <button onClick={() => update({ leadId: null })} className="shrink-0 text-xs text-slate-500 hover:text-rose-600">
                Detach
              </button>
            </div>
          ) : picking ? (
            <div className="relative">
              <input
                autoFocus
                value={leadQuery}
                onChange={(e) => setLeadQuery(e.target.value)}
                placeholder="Search leads…"
                className="w-full rounded-lg border-0 px-3 py-1.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
              />
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
                {leadOptions === null ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
                ) : leadOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">No matching leads</div>
                ) : (
                  leadOptions.map((l) => (
                    <button
                      key={l.id}
                      onClick={async () => (await update({ leadId: l.id })) && setPicking(false)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">{l.name}</span>
                      {(l.company || l.website) && <span className="text-slate-500"> · {l.company || l.website}</span>}
                    </button>
                  ))
                )}
                <button onClick={() => setPicking(false)} className="block w-full border-t border-slate-100 px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setPicking(true)} className="text-sm font-medium text-brand-700 hover:underline">
              + Attach to a lead
            </button>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (audit.notes ?? "") && update({ notes })}
            rows={2}
            placeholder="Private notes — who you sent it to, what they said…"
            className="w-full resize-y rounded-lg border-0 px-3 py-1.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
    </div>
  );
}

export function statusBadge(status: string) {
  const s = (AUDIT_STATUSES as readonly string[]).includes(status) ? (status as AuditStatusValue) : "NEW";
  return { className: AUDIT_STATUS_COLORS[s], label: AUDIT_STATUS_LABELS[s] };
}
