"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import useSWR, { mutate as mutateKey } from "swr";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatIstDate, formatMoney, formatMonthKey, todayIstDateKey } from "@/lib/format";
import { INVOICE_SOURCE_LABELS, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from "@/lib/constants";
import type { Invoice, InvoiceCompany, InvoiceYearSummary } from "@/types/models";
import InvoiceView from "./InvoiceView";
import InvoiceDashboard from "./InvoiceDashboard";
import InvoiceCard from "./InvoiceCard";

type Tab = "dashboard" | "invoices" | "records";

const TAB_LABELS: Record<Tab, string> = {
  dashboard: "Dashboard",
  invoices: "Invoices",
  records: "Monthly / yearly",
};

type ImportResult = {
  created: number;
  skipped: number;
  failed: number;
  results: { paymentId: string; outcome: string; invoiceId?: string; invoiceNumber?: string; error?: string }[];
};

export default function InvoicesClient({
  company,
  razorpayConfigured,
}: {
  company: InvoiceCompany;
  razorpayConfigured: boolean;
}) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [month, setMonth] = useState(todayIstDateKey().slice(0, 7));
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);

  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (status) params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  const { data, isLoading, error, mutate } = useSWR<{ invoices: Invoice[] }>(`/api/invoices?${params}`, fetcher);
  const { data: summaryData, mutate: mutateSummary } = useSWR<{ summary: InvoiceYearSummary[] }>(
    "/api/invoices/summary",
    fetcher,
  );

  const invoices = data?.invoices || [];
  const active = invoices.filter((i) => i.status !== "CANCELLED");
  const listTotal = active.reduce((s, i) => s + i.total, 0);

  function refresh() {
    mutate();
    mutateSummary();
    mutateKey("/api/invoices/dashboard");
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
          <p className="text-sm text-slate-500">
            Issued as {company.name} — saved on the server with monthly and yearly registers.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport((s) => !s)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Sync from Razorpay
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
        {(["dashboard", "invoices", "records"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 sm:px-4 ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <InvoiceDashboard onOpenInvoice={setPreview} onViewMonth={viewMonth} />
      ) : tab === "invoices" ? (
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
              className="order-last w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:order-none sm:w-auto sm:flex-1"
            />
            {month && (
              <button
                onClick={() => setMonth("")}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200"
              >
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
              <InvoiceCard key={inv.id} invoice={inv} onOpen={() => setPreview(inv)} />
            ))}
          </div>
        </>
      ) : (
        <Records summary={summaryData?.summary} onViewMonth={viewMonth} />
      )}

      {preview && <InvoicePreview invoice={preview} company={company} onClose={() => setPreview(null)} />}
    </div>
  );
}

// Opens over the list when an invoice is clicked: the full invoice as it
// appears on the PDF, with download / full-page links.
function InvoicePreview({
  invoice,
  company,
  onClose,
}: {
  invoice: Invoice;
  company: InvoiceCompany;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 pb-20 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Invoice ${invoice.invoiceNumber}`}
    >
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <a
            href={`/api/invoices/${invoice.id}/pdf?download=1`}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Download PDF
          </a>
          <Link
            href={`/invoices/${invoice.id}`}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Manage invoice
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕ Close
          </button>
        </div>
        <InvoiceView invoice={invoice} company={company} />
      </div>
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
        Years are Indian financial years (April–March). Amounts exclude cancelled invoices. Every register is also saved
        as a CSV file next to the invoice PDFs on the server.
      </p>
      {summary.map((year) => (
        <section key={year.financialYear} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">FY {year.financialYear}</h2>
            <a
              href={`/api/invoices/export?fy=${year.financialYear}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Download yearly register (CSV)
            </a>
          </div>
          <div className={`mb-4 grid grid-cols-2 gap-3 ${year.tax > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <Stat
              label="Invoices"
              value={String(year.count)}
              sub={year.cancelledCount ? `${year.cancelledCount} cancelled` : undefined}
            />
            {year.tax > 0 && <Stat label="Taxable value" value={formatMoney(year.subtotal)} />}
            {year.tax > 0 && <Stat label="GST" value={formatMoney(year.tax)} />}
            <Stat
              label="Total invoiced"
              value={formatMoney(year.total)}
              sub={year.unpaidCount ? `${year.unpaidCount} unpaid` : "all paid"}
            />
            {year.tax === 0 && <Stat label="Received" value={formatMoney(year.paidTotal)} />}
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${year.tax > 0 ? "min-w-[520px]" : ""}`}>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 text-right font-medium">Invoices</th>
                  {year.tax > 0 && <th className="py-2 text-right font-medium">Taxable</th>}
                  {year.tax > 0 && <th className="py-2 text-right font-medium">GST</th>}
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium">Register</th>
                </tr>
              </thead>
              <tbody>
                {year.months.map((m) => (
                  <tr key={m.month} className="border-b border-slate-100 last:border-0">
                    <td className="py-2">
                      <button
                        onClick={() => onViewMonth(m.month)}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {formatMonthKey(m.month)}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      {m.count}
                      {m.cancelledCount > 0 && <span className="text-slate-400"> (+{m.cancelledCount} cxl)</span>}
                    </td>
                    {year.tax > 0 && <td className="py-2 text-right">{formatMoney(m.subtotal)}</td>}
                    {year.tax > 0 && <td className="py-2 text-right">{formatMoney(m.tax)}</td>}
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-600">
          New Razorpay payments are turned into invoices <b>automatically</b> every 15 minutes. Click to pick up
          anything from the last 30 days right now — payments that already have an invoice are skipped.
        </p>
        <button
          onClick={() => run({ lastDays: 30 })}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Syncing…" : "Sync now"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        {showAdvanced ? "▾" : "▸"} Older payments or a single payment
      </button>
      {showAdvanced && (
        <>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run({ from, to });
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="text-sm text-slate-700">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-60"
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
        </>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>
      )}
      {result && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">
            {result.created} created · {result.skipped} already invoiced · {result.failed} failed
            {result.results.length === 0 && " — no captured payments found"}
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
