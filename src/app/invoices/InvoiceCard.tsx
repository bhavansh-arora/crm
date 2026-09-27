import { formatIstDate, formatMoney } from "@/lib/format";
import { INVOICE_SOURCE_LABELS, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from "@/lib/constants";
import type { Invoice } from "@/types/models";

// One invoice in a list: the main details at a glance; clicking anywhere
// on it calls onOpen (which shows the full invoice).
export default function InvoiceCard({ invoice: inv, onOpen }: { invoice: Invoice; onOpen: () => void }) {
  const cancelled = inv.status === "CANCELLED";
  const contact = [inv.customerEmail, inv.customerPhone].filter(Boolean).join(" · ");
  const description = inv.items.map((i) => i.description).join(", ");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-3">
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
          <div className="mt-1 truncate font-medium text-slate-900">{inv.customerName}</div>
          {contact && <div className="truncate text-sm text-slate-500">{contact}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-lg font-semibold ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {formatMoney(inv.total, inv.currency)}
          </div>
          <div className="text-xs text-slate-500">{formatIstDate(inv.invoiceDate)}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span className="min-w-0 truncate">
          <span className="text-slate-400">For:</span> {description}
        </span>
        {inv.paymentMethod && (
          <span>
            <span className="text-slate-400">Paid via:</span> {inv.paymentMethod}
          </span>
        )}
        {inv.lead && (
          <span>
            <span className="text-slate-400">Lead:</span> {inv.lead.name}
          </span>
        )}
      </div>
    </button>
  );
}
