"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatCurrency, formatDateTime, durationSince, relativeTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_COLORS,
  type CallOutcomeValue,
} from "@/lib/constants";
import type { LeadDetail, TeamMember } from "@/types/models";

type ComposerMode = null | "note" | "call" | "followup";

export default function LeadDetailClient({ leadId }: { leadId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user.role === "ADMIN";

  const { data, error, isLoading, mutate } = useSWR<{ lead: LeadDetail }>(
    `/api/leads/${leadId}`,
    fetcher
  );
  const { data: teamData } = useSWR<{ users: TeamMember[] }>(isAdmin ? "/api/users" : null, fetcher);
  const reps = (teamData?.users || []).filter((u) => u.role === "SALES_REP" && u.active);

  const [composer, setComposer] = useState<ComposerMode>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error || !data?.lead) {
    return (
      <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        Lead not found or you don&apos;t have access to it.
      </div>
    );
  }

  const lead = data.lead;

  async function changeStatus(status: string) {
    setBusy(true);
    setFormError(null);
    try {
      await apiRequest(`/api/leads/${leadId}`, "PATCH", { status });
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function changeAssignee(assignedToId: string) {
    setBusy(true);
    setFormError(null);
    try {
      await apiRequest(`/api/leads/${leadId}`, "PATCH", { assignedToId: assignedToId || null });
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to reassign lead");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLead() {
    if (!confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiRequest(`/api/leads/${leadId}`, "DELETE");
      router.push("/leads");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete lead");
      setBusy(false);
    }
  }

  const sortedFollowUps = [...lead.followUps].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button onClick={() => router.push("/leads")} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to leads
      </button>

      {formError && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{formError}</div>
      )}

      {/* Header card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{lead.name}</h1>
            <p className="text-sm text-slate-500">{lead.company || "No company"}</p>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Value" value={formatCurrency(lead.value)} />
          <Info label="Phone" value={lead.phone || "—"} />
          <Info label="Email" value={lead.email || "—"} />
          <Info label="Source" value={lead.source || "—"} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <select
              aria-label="Lead status"
              value={lead.status}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Assigned to:</span>
            {isAdmin ? (
              <select
                aria-label="Assigned sales rep"
                value={lead.assignedTo?.id || ""}
                disabled={busy}
                onChange={(e) => changeAssignee(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Unassigned</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium text-slate-700">{lead.assignedTo?.name || "Unassigned"}</span>
            )}
          </div>

          <span className="ml-auto text-xs text-slate-400">
            In &ldquo;{LEAD_STATUS_LABELS[lead.status]}&rdquo; for {durationSince(lead.statusChangedAt)}
          </span>
        </div>

        {isAdmin && (
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            >
              {editing ? "Close editor" : "Edit details"}
            </button>
            <button
              onClick={deleteLead}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
            >
              Delete lead
            </button>
          </div>
        )}

        {editing && isAdmin && (
          <EditLeadForm lead={lead} onSaved={() => { setEditing(false); mutate(); }} onError={setFormError} />
        )}
      </div>

      {/* Follow-ups */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Follow-ups</h2>
          {composer !== "followup" && (
            <button
              onClick={() => setComposer("followup")}
              className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              + Schedule follow-up
            </button>
          )}
        </div>

        {composer === "followup" && (
          <FollowUpForm
            leadId={leadId}
            onDone={() => {
              setComposer(null);
              mutate();
            }}
            onError={setFormError}
          />
        )}

        {sortedFollowUps.length === 0 && composer !== "followup" && (
          <p className="text-sm text-slate-400">No follow-ups scheduled.</p>
        )}

        <ul className="space-y-2">
          {sortedFollowUps.map((f) => {
            const overdue = !f.completed && new Date(f.dueAt).getTime() < Date.now();
            return (
              <li
                key={f.id}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ring-1 ${
                  f.completed
                    ? "bg-slate-50 text-slate-400 ring-slate-100"
                    : overdue
                      ? "bg-rose-50 ring-rose-200"
                      : "bg-amber-50 ring-amber-200"
                }`}
              >
                <div className="min-w-0">
                  <p className={`font-medium ${f.completed ? "line-through" : "text-slate-800"}`}>
                    {formatDateTime(f.dueAt)} {overdue && !f.completed && <span className="text-rose-600">(overdue)</span>}
                  </p>
                  {f.note && <p className="truncate text-xs text-slate-500">{f.note}</p>}
                </div>
                {!f.completed && (
                  <button
                    onClick={async () => {
                      await apiRequest(`/api/followups/${f.id}`, "PATCH", { completed: true });
                      mutate();
                    }}
                    className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Mark done
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Activity timeline */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Activity</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setComposer(composer === "call" ? null : "call")}
              className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              📞 Log call
            </button>
            <button
              onClick={() => setComposer(composer === "note" ? null : "note")}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              📝 Add note
            </button>
          </div>
        </div>

        {composer === "call" && (
          <CallForm
            leadId={leadId}
            onDone={() => {
              setComposer(null);
              mutate();
            }}
            onError={setFormError}
          />
        )}
        {composer === "note" && (
          <NoteForm
            leadId={leadId}
            onDone={() => {
              setComposer(null);
              mutate();
            }}
            onError={setFormError}
          />
        )}

        {lead.activities.length === 0 && composer === null && (
          <p className="text-sm text-slate-400">No activity yet.</p>
        )}

        <ul className="space-y-3">
          {lead.activities.map((a) => (
            <li key={a.id} className="border-l-2 border-slate-200 pl-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {a.type === "CALL" && (
                  <>
                    <span className="font-medium text-slate-800">Call {a.callNumber}</span>
                    {a.callOutcome && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CALL_OUTCOME_COLORS[a.callOutcome]}`}>
                        {CALL_OUTCOME_LABELS[a.callOutcome]}
                      </span>
                    )}
                  </>
                )}
                {a.type === "NOTE" && <span className="font-medium text-slate-800">Note</span>}
                {a.type === "STATUS_CHANGE" && (
                  <span className="font-medium text-slate-800">
                    Status: {a.fromStatus ? LEAD_STATUS_LABELS[a.fromStatus] : "—"} →{" "}
                    {a.toStatus ? LEAD_STATUS_LABELS[a.toStatus] : "—"}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {a.user?.name || "Unknown"} · {relativeTime(a.createdAt)}
                </span>
              </div>
              {a.note && <p className="mt-1 text-sm text-slate-600">{a.note}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}

function CallForm({
  leadId,
  onDone,
  onError,
}: {
  leadId: string;
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcomeValue>("CONNECTED");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    try {
      await apiRequest(`/api/leads/${leadId}/activities`, "POST", {
        type: "CALL",
        callOutcome: outcome,
        note: note || undefined,
      });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3">
      <select
        aria-label="Call outcome"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as CallOutcomeValue)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        {CALL_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {CALL_OUTCOME_LABELS[o]}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened on the call? (optional)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save call"}
        </button>
      </div>
    </div>
  );
}

function NoteForm({
  leadId,
  onDone,
  onError,
}: {
  leadId: string;
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!note.trim()) {
      onError("Note text is required.");
      return;
    }
    setLoading(true);
    onError(null);
    try {
      await apiRequest(`/api/leads/${leadId}/activities`, "POST", { type: "NOTE", note });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note about this lead…"
        rows={3}
        autoFocus
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}

function FollowUpForm({
  leadId,
  onDone,
  onError,
}: {
  leadId: string;
  onDone: () => void;
  onError: (msg: string | null) => void;
}) {
  const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [dueAt, setDueAt] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    try {
      await apiRequest(`/api/leads/${leadId}/followups`, "POST", { dueAt, note: note || undefined });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to schedule follow-up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3">
      <input
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reminder note (optional)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Schedule"}
      </button>
    </div>
  );
}

function EditLeadForm({
  lead,
  onSaved,
  onError,
}: {
  lead: LeadDetail;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [form, setForm] = useState({
    name: lead.name,
    email: lead.email || "",
    phone: lead.phone || "",
    company: lead.company || "",
    source: lead.source || "",
    value: String(lead.value),
  });
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    onError(null);
    try {
      await apiRequest(`/api/leads/${lead.id}`, "PATCH", { ...form, value: Number(form.value) || 0 });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
      <LabeledInput label="Name" value={form.name} onChange={(v) => update("name", v)} />
      <LabeledInput label="Email" value={form.email} onChange={(v) => update("email", v)} />
      <LabeledInput label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
      <LabeledInput label="Company" value={form.company} onChange={(v) => update("company", v)} />
      <LabeledInput label="Source" value={form.source} onChange={(v) => update("source", v)} />
      <LabeledInput label="Value" value={form.value} onChange={(v) => update("value", v)} type="number" />
      <div className="sm:col-span-2">
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
