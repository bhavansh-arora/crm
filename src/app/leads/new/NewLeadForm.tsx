"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_TEMPERATURES, LEAD_TEMPERATURE_LABELS } from "@/lib/constants";
import type { TeamMember, LeadListItem, LeadSource } from "@/types/models";

export default function NewLeadForm() {
  const router = useRouter();
  const { data: teamData } = useSWR<{ users: TeamMember[] }>("/api/users", fetcher);
  const reps = (teamData?.users || []).filter((u) => u.role === "SALES_REP" && u.active);
  const { data: sourcesData } = useSWR<{ sources: LeadSource[] }>("/api/sources", fetcher);
  const activeSources = (sourcesData?.sources || []).filter((s) => s.active);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "",
    value: "",
    status: "NEW",
    temperature: "",
    assignedToId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    try {
      const { lead } = await apiRequest<{ lead: LeadListItem }>("/api/leads", "POST", {
        ...form,
        value: form.value ? Number(form.value) : 0,
        assignedToId: form.assignedToId || null,
        temperature: form.temperature || null,
      });
      router.push(`/leads/${lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">New Lead</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>
        )}

        <Field label="Name" required>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input"
            placeholder="Jane Doe"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="input"
              placeholder="jane@company.com"
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="input"
              placeholder="+1 555 123 4567"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company">
            <input
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              className="input"
              placeholder="Acme Inc."
            />
          </Field>
          <Field label="Source">
            <select value={form.source} onChange={(e) => update("source", e.target.value)} className="input">
              <option value="">—</option>
              {activeSources.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            {activeSources.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                No sources yet —{" "}
                <Link href="/sources" className="underline hover:text-brand-700">
                  add some
                </Link>
                .
              </p>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Deal value (₹)">
            <input
              type="number"
              min={0}
              value={form.value}
              onChange={(e) => update("value", e.target.value)}
              className="input"
              placeholder="50000"
            />
          </Field>
          <Field label="Status">
            <select aria-label="Status" value={form.status} onChange={(e) => update("status", e.target.value)} className="input">
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Temperature">
            <select
              aria-label="Temperature"
              value={form.temperature}
              onChange={(e) => update("temperature", e.target.value)}
              className="input"
            >
              <option value="">Not set</option>
              {LEAD_TEMPERATURES.map((t) => (
                <option key={t} value={t}>
                  {LEAD_TEMPERATURE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Assign to sales rep">
          <select
            aria-label="Assign to sales rep"
            value={form.assignedToId}
            onChange={(e) => update("assignedToId", e.target.value)}
            className="input"
          >
            <option value="">Unassigned</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create Lead"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(203 213 225);
          padding: 0.625rem 0.75rem;
          font-size: 0.9375rem;
        }
        .input:focus {
          border-color: #3b6cf5;
          box-shadow: 0 0 0 3px rgba(59, 108, 245, 0.12);
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
