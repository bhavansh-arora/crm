"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/fetcher";
import type { LeadSource } from "@/types/models";

export default function SourcesClient() {
  const { data, mutate, isLoading } = useSWR<{ sources: LeadSource[] }>("/api/sources", fetcher);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sources = data?.sources || [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/api/sources", "POST", { name: name.trim() });
      setName("");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(source: LeadSource) {
    setError(null);
    try {
      await apiRequest(`/api/sources/${source.id}`, "PATCH", { active: !source.active });
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update source");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Lead Sources</h1>
      <p className="mb-5 text-sm text-slate-500">
        These show up in the dropdown when creating or editing a lead. Deactivate a source to hide
        it from new leads without losing history on leads that already used it.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mb-5 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Website, Referral, Instagram Ad"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Adding…" : "Add"}
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && sources.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No lead sources yet — add your first one above.
        </div>
      )}

      <div className="space-y-2">
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200"
          >
            <span className={`font-medium ${s.active ? "text-slate-900" : "text-slate-400 line-through"}`}>
              {s.name}
              <span className="ml-1.5 font-normal text-slate-400">
                ({s.leadCount} lead{s.leadCount === 1 ? "" : "s"})
              </span>
            </span>
            <button
              onClick={() => toggleActive(s)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
                s.active
                  ? "text-rose-600 ring-rose-200 hover:bg-rose-50"
                  : "text-emerald-600 ring-emerald-200 hover:bg-emerald-50"
              }`}
            >
              {s.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
