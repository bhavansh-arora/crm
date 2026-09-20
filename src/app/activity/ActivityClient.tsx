"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { relativeTime } from "@/lib/format";

type RepReport = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastActiveAt: string | null;
  onlineNow: boolean;
  totalActivities: number;
  statusChanges: number;
  notes: number;
  calls: number;
  maxStatusChangesIn1Min: number;
  maxStatusChangesIn5Min: number;
  maxStatusChangesIn10Min: number;
};

type ActivityReport = {
  range: string;
  reps: RepReport[];
};

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

// Bursts at or above these counts get flagged as unusually fast — a rep
// couldn't plausibly have done real work on that many leads that quickly.
const BURST_THRESHOLDS = { in1Min: 5, in5Min: 10, in10Min: 15 };

export default function ActivityClient() {
  const [range, setRange] = useState<string>("today");
  const { data, isLoading } = useSWR<ActivityReport>(`/api/admin/activity?range=${range}`, fetcher);

  const reps = data?.reps || [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Team Activity</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                range === r.value
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-5 text-sm text-slate-500">
        How much each rep is doing, and whether lead statuses are being updated at a suspiciously
        fast pace (real work on a lead rarely takes less than a minute).
      </p>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && reps.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No sales reps yet.
        </div>
      )}

      <div className="space-y-3">
        {reps.map((rep) => {
          const burst =
            rep.maxStatusChangesIn1Min >= BURST_THRESHOLDS.in1Min ||
            rep.maxStatusChangesIn5Min >= BURST_THRESHOLDS.in5Min ||
            rep.maxStatusChangesIn10Min >= BURST_THRESHOLDS.in10Min;

          return (
            <div key={rep.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {rep.name}
                    {!rep.active && (
                      <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-500">Inactive</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{rep.email}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    rep.onlineNow ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${rep.onlineNow ? "bg-emerald-500" : "bg-slate-300"}`} />
                  {rep.onlineNow ? "Online now" : rep.lastActiveAt ? `Last seen ${relativeTime(rep.lastActiveAt)}` : "Never logged in"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3 text-center sm:grid-cols-3">
                <MiniStat label="Status changes" value={rep.statusChanges} />
                <MiniStat label="Notes" value={rep.notes} />
                <MiniStat label="Calls logged" value={rep.calls} />
              </div>

              {burst && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
                  ⚠️ Rapid status changes detected — up to{" "}
                  <strong>{rep.maxStatusChangesIn1Min}</strong> in 1 min,{" "}
                  <strong>{rep.maxStatusChangesIn5Min}</strong> in 5 min, and{" "}
                  <strong>{rep.maxStatusChangesIn10Min}</strong> in 10 min. Worth a quick check that
                  these reflect real conversations.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-base font-semibold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
