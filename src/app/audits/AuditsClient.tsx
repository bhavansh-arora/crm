"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, fetcher } from "@/lib/fetcher";
import { AUDIT_STATUSES, AUDIT_STATUS_LABELS, type AuditStatusValue } from "@/lib/constants";
import { formatAuditDate, statusBadge, type SavedAudit } from "./AuditManageBar";

type AuditsResponse = {
  audits: SavedAudit[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; thisWeek: number; avgScore: number | null; byStatus: Record<AuditStatusValue, number> };
};

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "score_asc", label: "Lowest score first" },
  { value: "score_desc", label: "Highest score first" },
];

function scoreTone(score: number) {
  return score >= 75 ? "text-emerald-600 ring-emerald-200 bg-emerald-50" : score >= 50 ? "text-amber-700 ring-amber-200 bg-amber-50" : "text-rose-600 ring-rose-200 bg-rose-50";
}

export default function AuditsClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const createdById = searchParams.get("createdById") ?? "";
  const page = Number(searchParams.get("page")) || 1;
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [newUrl, setNewUrl] = useState("");

  function setParam(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in updates)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((searchParams.get("search") ?? "") !== search.trim()) setParam({ search: search.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = new URLSearchParams({ sort, page: String(page) });
  if (status) query.set("status", status);
  if (createdById) query.set("createdById", createdById);
  if (searchParams.get("search")) query.set("search", searchParams.get("search")!);
  const { data, error, isLoading, mutate } = useSWR<AuditsResponse>(`/api/site-audits?${query.toString()}`, fetcher, { keepPreviousData: true });
  const { data: users } = useSWR<{ users: { id: string; name: string }[] }>(isAdmin ? "/api/users" : null, fetcher);

  async function changeStatus(id: string, next: string) {
    await apiRequest(`/api/site-audits/${id}`, "PATCH", { status: next }).catch(() => null);
    mutate();
  }

  async function remove(a: SavedAudit) {
    if (!confirm(`Delete the audit of ${a.domain}? This can't be undone.`)) return;
    try {
      await apiRequest(`/api/site-audits/${a.id}`, "DELETE");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete");
    }
    mutate();
  }

  const stats = data?.stats;
  const sent = stats ? stats.total - stats.byStatus.NEW : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      {/* Header + new audit */}
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-5 py-6 text-ivory shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">Website Intelligence</div>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Site Audits</h1>
            <p className="mt-1 text-sm text-ivory/60">Every website you've audited — reopen reports, re-make videos and track who you've sent them to.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newUrl.trim()) window.location.assign(`/audit?url=${encodeURIComponent(newUrl.trim())}`);
            }}
            className="flex w-full items-center gap-2 rounded-full bg-white/[0.07] p-1.5 pl-4 ring-1 ring-white/15 focus-within:ring-gold-500/60 lg:w-[420px]"
          >
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Audit a new website…"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ivory placeholder:text-ivory/40 focus:outline-none"
            />
            <button type="submit" disabled={!newUrl.trim()} className="shrink-0 rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-400 disabled:opacity-50">
              Run audit
            </button>
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total audits" value={stats?.total ?? "–"} />
        <Stat label="This week" value={stats?.thisWeek ?? "–"} />
        <Stat label="Average score" value={stats?.avgScore ?? "–"} suffix={stats?.avgScore != null ? "/100" : undefined} />
        <Stat label="Sent to owners" value={stats ? sent : "–"} />
        <Stat label="Interested" value={stats?.byStatus.INTERESTED ?? "–"} tone="amber" />
        <Stat label="Won" value={stats?.byStatus.WON ?? "–"} tone="emerald" />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[{ value: "", label: "All", count: stats?.total }, ...AUDIT_STATUSES.map((s) => ({ value: s, label: AUDIT_STATUS_LABELS[s], count: stats?.byStatus[s] }))].map((t) => (
            <button
              key={t.value || "all"}
              onClick={() => setParam({ status: t.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                status === t.value ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {t.count != null && <span className={`ml-1.5 ${status === t.value ? "text-white/75" : "text-slate-400"}`}>{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by website, title or lead…"
            className="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
          />
          {isAdmin && (
            <select
              value={createdById}
              onChange={(e) => setParam({ createdById: e.target.value })}
              className="rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Everyone</option>
              {users?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => setParam({ sort: e.target.value })}
            className="rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {error ? (
        <p className="text-sm text-rose-600">Couldn't load audits: {error.message}</p>
      ) : isLoading && !data ? (
        <p className="text-sm text-slate-500">Loading audits…</p>
      ) : data && data.audits.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <div className="text-3xl">🔍</div>
          <p className="mt-3 font-medium text-slate-800">{stats?.total ? "No audits match these filters" : "No audits yet"}</p>
          <p className="mt-1 text-sm text-slate-500">
            {stats?.total ? "Try a different search or status." : "Enter a website above to run your first audit — it'll be saved here automatically."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data?.audits.map((a) => {
            const badge = statusBadge(a.status);
            return (
              <li key={a.id} className="group flex gap-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300 sm:p-4">
                <a href={`/audits/${a.id}`} className="relative hidden h-24 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/site-audits/${a.id}/thumbnail`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                    onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  />
                </a>
                <a href={`/audits/${a.id}`} className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full ring-1 ${scoreTone(a.score)}`}>
                  <span className="text-base font-semibold leading-none">{a.score}</span>
                  <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide opacity-70">{a.grade}</span>
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a href={`/audits/${a.id}`} className="truncate font-semibold text-slate-900 hover:text-brand-700">
                      {a.domain}
                    </a>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {a.siteType === "store" ? "Store" : "Business"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${badge.className}`}>{badge.label}</span>
                  </div>
                  {a.verdict ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.verdict}</p>
                  ) : a.pageTitle ? (
                    <p className="mt-1 truncate text-sm text-slate-500">{a.pageTitle}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{formatAuditDate(a.createdAt)}</span>
                    {a.createdBy && <span>by {a.createdBy.name}</span>}
                    {a.lead ? (
                      <Link href={`/leads/${a.lead.id}`} className="font-medium text-brand-700 hover:underline">
                        👤 {a.lead.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">No lead</span>
                    )}
                    {a.notes && <span className="max-w-xs truncate italic text-slate-400">“{a.notes}”</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-end gap-2 sm:justify-between">
                  <select
                    value={a.status}
                    onChange={(e) => changeStatus(a.id, e.target.value)}
                    aria-label="Status"
                    className="hidden rounded-md border-0 py-1 pl-2 pr-7 text-xs ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 sm:block"
                  >
                    {AUDIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {AUDIT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3 text-xs">
                    <a href={`/audits/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      Open
                    </a>
                    <button onClick={() => remove(a)} className="text-slate-400 hover:text-rose-600">
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
            className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setParam({ page: String(page + 1) })}
            className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, suffix, tone }: { label: string; value: number | string; suffix?: string; tone?: "amber" | "emerald" }) {
  const color = tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>
        {value}
        {suffix && <span className="ml-0.5 text-sm font-normal text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}
