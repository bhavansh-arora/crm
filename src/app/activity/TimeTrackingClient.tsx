"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatTime, formatMinutes, formatDayKey } from "@/lib/format";

type Session = { start: string; end: string; minutes: number };
type DayEntry = { date: string; totalMinutes: number; sessions: Session[] };
type RepDays = { id: string; name: string; email: string; active: boolean; days: DayEntry[] };
type TimeTrackingReport = { range: string; reps: RepDays[] };

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export default function TimeTrackingClient() {
  const [range, setRange] = useState<string>("7d");
  const { data, isLoading } = useSWR<TimeTrackingReport>(
    `/api/admin/time-tracking?range=${range}`,
    fetcher
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reps = data?.reps || [];

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Time each rep had the CRM open and in the foreground, per day, based on a heartbeat
          ping sent about once a minute. This measures time in the app -- not time on the phone
          or doing other work away from the screen -- so treat it as a useful estimate, not an
          exact timesheet.
        </p>
        <div className="flex shrink-0 gap-2">
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

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && reps.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No sales reps yet.
        </div>
      )}

      <div className="space-y-4">
        {reps.map((rep) => {
          const totalMinutes = rep.days.reduce((sum, d) => sum + d.totalMinutes, 0);
          return (
            <div key={rep.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {rep.name}
                    {!rep.active && (
                      <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-500">
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{rep.email}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {formatMinutes(totalMinutes)} total
                </span>
              </div>

              {rep.days.length === 0 ? (
                <p className="text-sm text-slate-400">No activity in this range.</p>
              ) : (
                <div className="space-y-1.5">
                  {rep.days.map((day) => {
                    const key = `${rep.id}-${day.date}`;
                    const isOpen = expanded.has(key);
                    return (
                      <div key={day.date} className="rounded-lg bg-slate-50 ring-1 ring-slate-100">
                        <button
                          onClick={() => toggle(key)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                        >
                          <span className="font-medium text-slate-700">{formatDayKey(day.date)}</span>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            {formatMinutes(day.totalMinutes)} · {day.sessions.length} session
                            {day.sessions.length === 1 ? "" : "s"}
                            <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="space-y-1 border-t border-slate-200 px-3 py-2">
                            {day.sessions.map((s, i) => (
                              <li key={i} className="flex items-center justify-between text-xs text-slate-600">
                                <span>
                                  {formatTime(s.start)} – {formatTime(s.end)}
                                </span>
                                <span className="text-slate-400">{formatMinutes(s.minutes)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
