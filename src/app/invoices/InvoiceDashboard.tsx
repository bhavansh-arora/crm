"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatMoney, formatMonthKey } from "@/lib/format";
import type { Invoice, InvoiceDashboardData } from "@/types/models";
import InvoiceCard from "./InvoiceCard";

export default function InvoiceDashboard({
  onOpenInvoice,
  onViewMonth,
}: {
  onOpenInvoice: (invoice: Invoice) => void;
  onViewMonth: (month: string) => void;
}) {
  const { data, error, isLoading } = useSWR<{ dashboard: InvoiceDashboardData }>("/api/invoices/dashboard", fetcher);

  if (error) return <p className="text-sm text-rose-600">{error.message}</p>;
  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading…</p>;
  const d = data.dashboard;

  const change =
    d.lastMonth.total > 0 ? Math.round(((d.thisMonth.total - d.lastMonth.total) / d.lastMonth.total) * 100) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={`This month (${formatMonthKey(d.thisMonth.month)})`}
          value={formatMoney(d.thisMonth.total)}
          sub={
            change === null
              ? `${d.thisMonth.count} invoice${d.thisMonth.count === 1 ? "" : "s"}`
              : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs ${formatMonthKey(d.lastMonth.month)}`
          }
        />
        <Tile
          label={`This financial year (${d.thisYear.financialYear})`}
          value={formatMoney(d.thisYear.total)}
          sub={`${d.thisYear.count} invoice${d.thisYear.count === 1 ? "" : "s"}`}
        />
        <Tile
          label="Received this year"
          value={formatMoney(d.thisYear.paidTotal)}
          sub={`${d.thisYear.paidCount} paid`}
        />
        <Tile
          label="Unpaid"
          value={formatMoney(d.unpaid.total)}
          sub={
            d.unpaid.count ? `${d.unpaid.count} invoice${d.unpaid.count === 1 ? "" : "s"} waiting` : "Nothing pending"
          }
          tone={d.unpaid.count ? "warn" : undefined}
        />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Invoiced per month</h2>
        <p className="mb-4 text-xs text-slate-500">
          Last 12 months, excluding cancelled invoices. Click a month to see its invoices.
        </p>
        <MonthlyChart months={d.months} onSelect={onViewMonth} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent invoices</h2>
          {d.recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No invoices yet — they&apos;ll appear here as Razorpay payments come in, or create one with + New invoice.
            </div>
          ) : (
            <div className="space-y-2">
              {d.recent.map((inv) => (
                <InvoiceCard key={inv.id} invoice={inv} onOpen={() => onOpenInvoice(inv)} />
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Top customers this year</h2>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            {d.topCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices this financial year yet.</p>
            ) : (
              <ol className="space-y-3">
                {d.topCustomers.map((c, i) => (
                  <li key={c.name} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-slate-900">
                        <span className="mr-2 text-slate-400">{i + 1}</span>
                        {c.name}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-900">{formatMoney(c.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-brand-600"
                        style={{ width: `${Math.max(2, (c.total / d.topCustomers[0].total) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${tone === "warn" ? "text-amber-700" : "text-slate-500"}`}>{sub}</div>}
    </div>
  );
}

// "Nice" upper bound for the y-axis: 1, 2 or 5 x 10^n at or above max.
function niceMax(max: number): number {
  if (max <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

function compactRupees(n: number): string {
  if (n >= 10000000) return `₹${+(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${+(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${+(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

// Single-series column chart (one brand hue, so no legend -- the heading
// names it). Hover/focus a column for the exact figure; the latest month
// is direct-labelled; "Show as table" gives the same numbers as text.
function MonthlyChart({
  months,
  onSelect,
}: {
  months: InvoiceDashboardData["months"];
  onSelect: (month: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // Drawn at its real on-screen width (not a fixed viewBox scaled down), so
  // axis text stays readable on a phone instead of shrinking with the chart.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);

  const narrow = W < 500;
  const H = narrow ? 200 : 240;
  const pad = { top: 20, right: 4, bottom: 28, left: narrow ? 44 : 52 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...months.map((m) => m.total)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = plotW / months.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const last = months.length - 1;

  if (asTable) {
    return (
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 font-medium">Month</th>
              <th className="py-1.5 text-right font-medium">Invoices</th>
              <th className="py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={m.month} className="border-b border-slate-100">
                <td className="py-1.5">{formatMonthKey(m.month)}</td>
                <td className="py-1.5 text-right">{m.count}</td>
                <td className="py-1.5 text-right font-medium">{formatMoney(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => setAsTable(false)} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
          Show as chart
        </button>
      </div>
    );
  }

  const hovered = hover !== null ? months[hover] : null;

  return (
    <div>
      <div className="relative" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block max-w-full"
          role="img"
          aria-label="Invoiced per month, last 12 months"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e8eaee" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#64748b">
                {compactRupees(t)}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = pad.left + band * i + band / 2;
            const h = Math.max(0, y(0) - y(m.total));
            const r = Math.min(4, h);
            const x0 = cx - barW / 2;
            const top = y(m.total);
            // Rounded data-end, square at the baseline.
            const path =
              h > 0
                ? `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`
                : "";
            const [yr, mo] = m.month.split("-").map(Number);
            const label = new Date(yr, mo - 1, 1).toLocaleString("en-US", { month: narrow ? "narrow" : "short" });
            return (
              <g
                key={m.month}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(m.month)}
                tabIndex={0}
                role="button"
                aria-label={`${formatMonthKey(m.month)}: ${formatMoney(m.total)}, ${m.count} invoices`}
                className="cursor-pointer outline-none"
              >
                {/* Hit target: the full band, not just the bar */}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={plotH}
                  fill={hover === i ? "#f1f5f9" : "transparent"}
                />
                {path && <path d={path} fill="#2f56d1" opacity={hover === null || hover === i ? 1 : 0.55} />}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                  {label}
                </text>
                {i === last && m.total > 0 && hover === null && (
                  // Right-aligned when centring it would run off the edge (phones).
                  <text
                    x={cx + 26 > W ? W - 2 : cx}
                    y={top - 6}
                    textAnchor={cx + 26 > W ? "end" : "middle"}
                    fontSize={11}
                    fontWeight={600}
                    fill="#0f172a"
                  >
                    {compactRupees(m.total)}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1} />
        </svg>
        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%` }}
          >
            <div className="font-semibold">{formatMonthKey(hovered.month)}</div>
            <div>{formatMoney(hovered.total)}</div>
            <div className="text-slate-300">
              {hovered.count} invoice{hovered.count === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </div>
      <button onClick={() => setAsTable(true)} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
        Show as table
      </button>
    </div>
  );
}
