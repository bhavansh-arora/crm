"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatIstDate, formatMoney, formatMonthKey, todayIstDateKey } from "@/lib/format";
import { INVOICE_SOURCE_LABELS, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from "@/lib/constants";
import type { Invoice, InvoiceYearSummary } from "@/types/models";

type Tab = "invoices" | "records";

type ImportResult = {
  created: number;
  skipped: number;
  failed: number;
  results: { paymentId: string; outcome: string; invoiceId?: string; invoiceNumber?: string; error?: string }[];
};

export default function InvoicesClient({
  companyName,
  razorpayConfigured,
}: {
  companyName: string;
  razorpayConfigured: boolean;
}) {
  const [tab, setTab] = useState<Tab>("invoices");
  const [month, setMonth] = useState(todayIstDateKey().slice(0, 7));
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(false);

  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  const { data, isLoading, error, mutate } = useSWR<{ invoices: Invoice[] }>(`/api/invoices?${params}`, fetcher);
  const { data: summaryData, mutate: mutateSummary } = useSWR<{ summary: InvoiceYearSummary[] }>(
    "/api/invoices/summary",
    fetcher
  );

  const invoices = data?.invoices || [];
  const active = invoices.filter((i) => i.status !== "CANCELLED");
  const listTotal = active.reduce((s, i) => s + i.total, 0);

  function refresh() {
    mutate();
    mutateSummary();
  }

  function viewMonth(key: string) {
    setMonth(key);
    setStatus("");
    setQ("");
    setTab("invoices");
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">Issued as {companyName} — saved on the server with monthly and yearly registers.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport((s) => !s)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Import from Razorpay
          </button>
          <Link
            href="/invoices/new"
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + New invoice
          </Link>
        </div>
      </div>

      {showImport && <RazorpayImport configured={razorpayConfigured} onImported={refresh} />}

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium sm:inline-flex">
        {(["invoices", "records"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {t === "invoices" ? "Invoices" : "Monthly & yearly records"}
          </button>
        ))}
      </div>

      {tab === "invoices" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="month"
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, customer, email, payment ID"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            {month && (
              <button onClick={() => setMonth("")} className="rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
                All months
              </button>
            )}
          </div>

          {month && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <span>
                {formatMonthKey(month)}: <b>{active.length}</b> invoice{active.length === 1 ? "" : "s"},{" "}
                <b>{formatMoney(listTotal)}</b>
                {status || q ? " (filtered)" : ""}
              </span>
              <a href={`/api/invoices/export?month=${month}`} className="font-medium text-brand-700 hover:underline">
                Download monthly register (CSV)
              </a>
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error.message}</p>}
          {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {!isLoading && invoices.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No invoices {month ? `in ${formatMonthKey(month)}` : "yet"}.
            </div>
          )}

          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{inv.invoiceNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {INVOICE_SOURCE_LABELS[inv.source]}
                    </span>
                  </div>
                  <div className="truncate text-sm text-slate-600">
                    {inv.customerName} · {formatIstDate(inv.invoiceDate)}
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold ${inv.status === "CANCELLED" ? "text-slate-400 line-through" : "text-slate-900"}`}
                >
                  {formatMoney(inv.total, inv.currency)}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <Records summary={summaryData?.summary} onViewMonth={viewMonth} />
      )}
    </div>
  );
}

function Records({
  summary,
  onViewMonth,
}: {
  summary: InvoiceYearSummary[] | undefined;
  onViewMonth: (month: string) => void;
}) {
  if (!summary) return <p className="text-sm text-slate-500">Loading…</p>;
  if (summary.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No invoices yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Years are Indian financial years (April–March). Amounts exclude cancelled invoices. Every register is also
        saved as a CSV file next to the invoice PDFs on the server.
      </p>
      {summary.map((year) => (
        <section key={year.financialYear} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">FY {year.financialYear}</h2>
            <a href={`/api/invoices/export?fy=${year.financialYear}`} className="text-sm font-medium text-brand-700 hover:underline">
              Download yearly register (CSV)
            </a>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Invoices" value={String(year.count)} sub={year.cancelledCount ? `${year.cancelledCount} cancelled` : undefined} />
            <Stat label="Taxable value" value={formatMoney(year.subtotal)} />
            <Stat label="GST" value={formatMoney(year.tax)} />
            <Stat
              label="Total invoiced"
              value={formatMoney(year.total)}
              sub={year.unpaidCount ? `${year.unpaidCount} unpaid` : "all paid"}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 text-right font-medium">Invoices</th>
                  <th className="py-2 text-right font-medium">Taxable</th>
                  <th className="py-2 text-right font-medium">GST</th>
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium">Register</th>
                </tr>
              </thead>
              <tbody>
                {year.months.map((m) => (
                  <tr key={m.month} className="border-b border-slate-100 last:border-0">
                    <td className="py-2">
                      <button onClick={() => onViewMonth(m.month)} className="font-medium text-slate-900 hover:text-brand-700">
                        {formatMonthKey(m.month)}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      {m.count}
                      {m.cancelledCount > 0 && <span className="text-slate-400"> (+{m.cancelledCount} cxl)</span>}
                    </td>
                    <td className="py-2 text-right">{formatMoney(m.subtotal)}</td>
                    <td className="py-2 text-right">{formatMoney(m.tax)}</td>
                    <td className="py-2 text-right font-semibold">{formatMoney(m.total)}</td>
                    <td className="py-2 text-right">
                      <a href={`/api/invoices/export?month=${m.month}`} className="text-brand-700 hover:underline">
                        CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function RazorpayImport({ configured, onImported }: { configured: boolean; onImported: () => void }) {
  const today = todayIstDateKey();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [paymentId, setPaymentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run(body: object) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiRequest<ImportResult>("/api/invoices/razorpay", "POST", body));
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
        Razorpay isn&apos;t set up yet — add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> to the
        server&apos;s <code>.env</code> and restart.
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-600">
        Issues an invoice for every <b>captured</b> Razorpay payment. Payments that already have an invoice are skipped,
        so it&apos;s safe to run again.
      </p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          run({ from, to });
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="text-sm text-slate-700">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm text-slate-700">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Importing…" : "Import payments"}
        </button>
      </form>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (paymentId.trim()) run({ paymentId: paymentId.trim() });
        }}
        className="flex flex-wrap gap-2 border-t border-slate-100 pt-4"
      >
        <input
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
          placeholder="Or a single payment ID, e.g. pay_ABC123"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !paymentId.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60"
        >
          Create invoice
        </button>
      </form>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>}
      {result && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">
            {result.created} created · {result.skipped} already invoiced · {result.failed} failed
            {result.results.length === 0 && " — no captured payments in that range"}
          </p>
          {result.results.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-slate-600">
              {result.results.map((r) => (
                <li key={r.paymentId} className="font-mono text-xs">
                  {r.paymentId} →{" "}
                  {r.invoiceId ? (
                    <Link href={`/invoices/${r.invoiceId}`} className="text-brand-700 hover:underline">
                      {r.invoiceNumber}
                    </Link>
                  ) : (
                    <span className="text-rose-600">{r.error}</span>
                  )}
                  {r.outcome === "exists" && " (existing)"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
