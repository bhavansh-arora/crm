"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/fetcher";
import { formatDateTime, formatIstDate, formatMoney } from "@/lib/format";
import { INVOICE_SOURCE_LABELS, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from "@/lib/constants";
import type { Invoice, InvoiceCompany } from "@/types/models";
import InvoiceView from "../InvoiceView";

export default function InvoiceDetailClient({ id, company }: { id: string; company: InvoiceCompany }) {
  const { data, error, isLoading, mutate } = useSWR<{ invoice: Invoice }>(`/api/invoices/${id}`, fetcher);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error || !data) return <p className="text-sm text-rose-600">{error?.message || "Invoice not found"}</p>;
  const inv = data.invoice;

  async function setStatus(status: Invoice["status"]) {
    if (status === "CANCELLED" && !confirm(`Cancel invoice ${inv.invoiceNumber}? This can't be undone.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiRequest(`/api/invoices/${id}`, "PATCH", { status });
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update invoice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/invoices" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Invoices
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold text-slate-900">{inv.invoiceNumber}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>
              {INVOICE_STATUS_LABELS[inv.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {formatIstDate(inv.invoiceDate)} · {INVOICE_SOURCE_LABELS[inv.source]}
            {inv.createdBy && <> · by {inv.createdBy.name}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/invoices/${id}/pdf?download=1`}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Download PDF
          </a>
          {inv.status === "UNPAID" && (
            <button
              disabled={busy}
              onClick={() => setStatus("PAID")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
            >
              Mark paid
            </button>
          )}
          {inv.status === "PAID" && inv.source !== "RAZORPAY" && (
            <button
              disabled={busy}
              onClick={() => setStatus("UNPAID")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50 disabled:opacity-60"
            >
              Mark unpaid
            </button>
          )}
          {inv.status !== "CANCELLED" && (
            <button
              disabled={busy}
              onClick={() => setStatus("CANCELLED")}
              className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
            >
              Cancel invoice
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">
          {actionError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</h2>
            <p className="font-semibold text-slate-900">{inv.customerName}</p>
            {inv.customerAddress && <p className="whitespace-pre-line text-sm text-slate-600">{inv.customerAddress}</p>}
            {inv.customerEmail && <p className="text-sm text-slate-600">{inv.customerEmail}</p>}
            {inv.customerPhone && <p className="text-sm text-slate-600">{inv.customerPhone}</p>}
            {inv.customerGstin && <p className="text-sm text-slate-600">GSTIN: {inv.customerGstin}</p>}
            {inv.lead && (
              <Link href={`/leads/${inv.lead.id}`} className="mt-2 inline-block text-sm text-brand-700 hover:underline">
                Lead: {inv.lead.name} →
              </Link>
            )}
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</h2>
            <ul className="space-y-2 text-sm">
              {inv.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-slate-700">
                    {item.description}
                    <span className="text-slate-400">
                      {" "}
                      × {item.quantity} @ {formatMoney(item.rate, inv.currency)}
                    </span>
                  </span>
                  <span className="shrink-0">{formatMoney(item.quantity * item.rate, inv.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <dt>Subtotal</dt>
                <dd>{formatMoney(inv.subtotal, inv.currency)}</dd>
              </div>
              {inv.taxRate > 0 && (
                <div className="flex justify-between text-slate-500">
                  <dt>GST @ {inv.taxRate}%</dt>
                  <dd>{formatMoney(inv.taxAmount, inv.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-slate-900">
                <dt>Total</dt>
                <dd>{formatMoney(inv.total, inv.currency)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Record</h2>
            <dl className="space-y-1 text-slate-600">
              {inv.paymentMethod && <Row label="Payment method" value={inv.paymentMethod} />}
              {inv.razorpayPaymentId && <Row label="Razorpay payment" value={inv.razorpayPaymentId} mono />}
              <Row label="Financial year" value={inv.financialYear} />
              <Row
                label="Saved on server"
                value={inv.pdfPath ? `invoices/${inv.pdfPath}` : "Not yet (re-created on download)"}
                mono
              />
              <Row label="Created" value={formatDateTime(inv.createdAt)} />
              {inv.cancelledAt && <Row label="Cancelled" value={formatDateTime(inv.cancelledAt)} />}
            </dl>
            {inv.notes && <p className="mt-3 whitespace-pre-line text-slate-600">{inv.notes}</p>}
          </section>
        </div>

        <InvoiceView invoice={inv} company={company} />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
