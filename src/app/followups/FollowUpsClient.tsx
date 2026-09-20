"use client";

import useSWR from "swr";
import Link from "next/link";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import type { FollowUp } from "@/types/models";

export default function FollowUpsClient() {
  const { data, isLoading, mutate } = useSWR<{ followUps: FollowUp[] }>("/api/followups?scope=open", fetcher);
  const followUps = data?.followUps || [];

  const now = Date.now();
  const overdue = followUps.filter((f) => new Date(f.dueAt).getTime() < now);
  const upcoming = followUps.filter((f) => new Date(f.dueAt).getTime() >= now);

  async function markDone(id: string) {
    await apiRequest(`/api/followups/${id}`, "PATCH", { completed: true });
    mutate();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Follow-ups</h1>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && followUps.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nothing due. Nice work!
        </div>
      )}

      {overdue.length > 0 && (
        <Section title={`Overdue (${overdue.length})`} items={overdue} onDone={markDone} tone="overdue" />
      )}
      {upcoming.length > 0 && (
        <Section title={`Upcoming (${upcoming.length})`} items={upcoming} onDone={markDone} tone="upcoming" />
      )}
    </div>
  );
}

function Section({
  title,
  items,
  onDone,
  tone,
}: {
  title: string;
  items: FollowUp[];
  onDone: (id: string) => void;
  tone: "overdue" | "upcoming";
}) {
  return (
    <div className="mb-6">
      <h2 className={`mb-2 text-sm font-semibold ${tone === "overdue" ? "text-rose-600" : "text-slate-600"}`}>
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((f) => (
          <div
            key={f.id}
            className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${
              tone === "overdue" ? "ring-rose-200" : "ring-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/leads/${f.leadId}`} className="font-medium text-slate-900 hover:underline">
                  {f.lead?.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {f.lead?.company || "—"} {f.lead?.assignedTo ? `· ${f.lead.assignedTo.name}` : ""}
                </p>
              </div>
              {f.lead && <StatusBadge status={f.lead.status} />}
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">{formatDateTime(f.dueAt)}</p>
            {f.note && <p className="text-sm text-slate-500">{f.note}</p>}
            <button
              onClick={() => onDone(f.id)}
              className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              Mark done
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
