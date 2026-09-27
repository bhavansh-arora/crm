"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/fetcher";
import { computeTotals } from "@/lib/invoice-math";
import { formatMoney, todayIstDateKey } from "@/lib/format";
import type { Invoice } from "@/types/models";

type LeadPrefill = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  value: number;
} | null;

type ItemRow = { description: string; quantity: string; rate: string };

const PAYMENT_METHODS = ["Razorpay", "UPI", "Bank transfer", "Cash", "Cheque", "Card"];

export default function NewInvoiceForm({ defaultTaxRate, lead }: { defaultTaxRate: number; lead: LeadPrefill }) {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: lead?.name || "",
    customerEmail: lead?.email || "",
    customerPhone: lead?.phone || "",
    customerAddress: "",
    customerGstin: "",
    invoiceDate: todayIstDateKey(),
    taxRate: String(defaultTaxRate),
    taxInclusive: false,
    status: "PAID",
    paymentMethod: "",
    notes: "",
  });
  const [items, setItems] = useState<ItemRow[]>([
    { description: "", quantity: "1", rate: lead?.value ? String(lead.value) : "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateItem(index: number, key: keyof ItemRow, value: string) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  const parsedItems = items.map((i) => ({
    description: i.description,
    quantity: Number(i.quantity) || 0,
    rate: Number(i.rate) || 0,
  }));
  const taxRate = Number(form.taxRate) || 0;
  const totals = computeTotals(parsedItems, taxRate, form.taxInclusive);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.customerName.trim()) return setError("Customer name is required.");
    if (items.some((i) => !i.description.trim())) return setError("Every line item needs a description.");
    if (totals.total <= 0) return setError("Invoice total must be greater than 0.");

    setLoading(true);
    try {
      const { invoice } = await apiRequest<{ invoice: Invoice }>("/api/invoices", "POST", {
        ...form,
        taxRate,
        items: parsedItems,
        leadId: lead?.id || null,
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/invoices" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Invoices
      </Link>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">New Invoice</h1>
      <p className="mb-5 text-sm text-slate-500">
        The invoice number is assigned automatically when you save.
        {lead && <> Linked to lead <span className="font-medium text-slate-700">{lead.name}</span>.</>}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>
        )}

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bill to</h2>
          <Field label="Customer / business name" required>
            <input value={form.customerName} onChange={(e) => update("customerName", e.target.value)} className="input" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => update("customerEmail", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Phone">
              <input value={form.customerPhone} onChange={(e) => update("customerPhone", e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Billing address">
            <textarea
              rows={2}
              value={form.customerAddress}
              onChange={(e) => update("customerAddress", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Customer GSTIN">
            <input
              value={form.customerGstin}
              onChange={(e) => update("customerGstin", e.target.value.toUpperCase())}
              className="input"
              placeholder="Optional"
            />
          </Field>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Line items</h2>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
                <input
                  aria-label="Description"
                  placeholder="Description, e.g. Website development"
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                  className="input col-span-12 sm:col-span-6"
                />
                <input
                  aria-label="Quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                  className="input col-span-3 sm:col-span-2"
                />
                <input
                  aria-label="Rate"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Rate (₹)"
                  value={item.rate}
                  onChange={(e) => updateItem(index, "rate", e.target.value)}
                  className="input col-span-6 sm:col-span-3"
                />
                <button
                  type="button"
                  onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                  disabled={items.length === 1}
                  className="col-span-3 rounded-lg text-sm text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-30 sm:col-span-1"
                  aria-label="Remove line item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, { description: "", quantity: "1", rate: "" }])}
            className="mt-3 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
          >
            + Add line item
          </button>

          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Field label="GST rate (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={form.taxRate}
                  onChange={(e) => update("taxRate", e.target.value)}
                  className="input"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.taxInclusive}
                  onChange={(e) => update("taxInclusive", e.target.checked)}
                />
                Rates above already include GST
              </label>
            </div>
            <dl className="space-y-1.5 self-end text-sm">
              <div className="flex justify-between text-slate-500">
                <dt>Subtotal</dt>
                <dd>{formatMoney(totals.subtotal)}</dd>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-slate-500">
                  <dt>GST @ {taxRate}%</dt>
                  <dd>{formatMoney(totals.taxAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-semibold text-slate-900">
                <dt>Total</dt>
                <dd>{formatMoney(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Details</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Invoice date">
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => update("invoiceDate", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => update("status", e.target.value)} className="input">
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </Field>
            <Field label="Payment method">
              <input
                list="payment-methods"
                value={form.paymentMethod}
                onChange={(e) => update("paymentMethod", e.target.value)}
                className="input"
                placeholder="e.g. UPI"
              />
              <datalist id="payment-methods">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Notes (printed on the invoice)">
            <textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} className="input" />
          </Field>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create Invoice"}
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
          background: white;
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
