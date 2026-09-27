import { amountInWords } from "@/lib/invoice-math";
import { formatIstDate, formatMoney } from "@/lib/format";
import type { Invoice, InvoiceCompany } from "@/types/models";

// On-screen copy of the invoice, laid out like the PDF from
// src/lib/invoice-pdf.ts. Rendered as HTML rather than an embedded PDF so
// it shows up everywhere -- mobile browsers (Android Chrome in particular)
// won't display a PDF inside an iframe.
export default function InvoiceView({ invoice, company }: { invoice: Invoice; company: InvoiceCompany }) {
  const addressLines = company.address
    .replace(/\\n/g, "\n")
    .split(/\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);
  const money = (n: number) => formatMoney(n, invoice.currency);

  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-200 sm:p-8">
      {invoice.status === "CANCELLED" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[30deg] text-6xl font-extrabold tracking-widest text-rose-600/15 sm:text-8xl">
            CANCELLED
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-brand-600">{company.name}</div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            {addressLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
            {company.gstin && <div>GSTIN: {company.gstin}</div>}
            {company.email && <div>Email: {company.email}</div>}
            {company.phone && <div>Phone: {company.phone}</div>}
            {company.website && <div>{company.website}</div>}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-xl font-bold">{invoice.taxRate > 0 ? "TAX INVOICE" : "INVOICE"}</div>
          <dl className="mt-2 space-y-0.5 text-sm">
            <div>
              <dt className="inline text-slate-500">Invoice No. </dt>
              <dd className="inline font-semibold">{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Invoice Date </dt>
              <dd className="inline font-semibold">{formatIstDate(invoice.invoiceDate)}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Status </dt>
              <dd className="inline font-semibold">{invoice.status}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Bill to</div>
        <div className="font-semibold">{invoice.customerName}</div>
        <div className="space-y-0.5 text-xs text-slate-500">
          {invoice.customerAddress && <div className="whitespace-pre-line">{invoice.customerAddress}</div>}
          {invoice.customerEmail && <div>{invoice.customerEmail}</div>}
          {invoice.customerPhone && <div>{invoice.customerPhone}</div>}
          {invoice.customerGstin && <div>GSTIN: {invoice.customerGstin}</div>}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-50 text-left text-xs">
              <th className="hidden px-2 py-2 font-semibold sm:table-cell">#</th>
              <th className="px-2 py-2 font-semibold">Description</th>
              <th className="px-2 py-2 text-right font-semibold">Qty</th>
              <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Rate</th>
              <th className="px-2 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="hidden px-2 py-2 text-slate-500 sm:table-cell">{i + 1}</td>
                <td className="px-2 py-2">{item.description}</td>
                <td className="px-2 py-2 text-right">{item.quantity}</td>
                <td className="hidden px-2 py-2 text-right sm:table-cell">{money(item.rate)}</td>
                <td className="px-2 py-2 text-right">{money(item.quantity * item.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-slate-500">
          <dt>Subtotal</dt>
          <dd>{money(invoice.subtotal)}</dd>
        </div>
        {invoice.taxRate > 0 && (
          <div className="flex justify-between text-slate-500">
            <dt>GST @ {invoice.taxRate}%</dt>
            <dd>{money(invoice.taxAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
          <dt>Total</dt>
          <dd>{money(invoice.total)}</dd>
        </div>
      </dl>

      {invoice.currency === "INR" && (
        <p className="mt-3 text-xs text-slate-500">Amount in words: {amountInWords(invoice.total)}</p>
      )}

      {(invoice.paymentMethod || invoice.razorpayPaymentId) && (
        <div className="mt-4 text-sm">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment</div>
          {invoice.paymentMethod && <div>Payment method: {invoice.paymentMethod}</div>}
          {invoice.razorpayPaymentId && (
            <div className="break-all">Razorpay payment ID: {invoice.razorpayPaymentId}</div>
          )}
        </div>
      )}
      {invoice.notes && (
        <div className="mt-4 text-sm">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Notes</div>
          <div className="whitespace-pre-line">{invoice.notes}</div>
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
        <div>{company.footer}</div>
        <div>This is a computer-generated invoice and does not require a signature.</div>
      </div>
    </div>
  );
}
