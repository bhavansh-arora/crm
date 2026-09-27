// Pure invoice arithmetic, shared by the server (src/lib/invoices.ts) and
// the "New invoice" form's live preview.

export type InvoiceItem = { description: string; quantity: number; rate: number };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(items: InvoiceItem[], taxRate: number, taxInclusive: boolean) {
  const factor = 1 + taxRate / 100;
  if (taxInclusive) {
    const total = round2(items.reduce((sum, i) => sum + i.quantity * i.rate, 0));
    const exclusiveItems = items.map((i) => ({ ...i, rate: round2(i.rate / factor) }));
    const subtotal = round2(exclusiveItems.reduce((sum, i) => sum + i.quantity * i.rate, 0));
    // Any paisa of rounding difference lands in the tax line, so the total
    // always matches exactly what was actually paid.
    return { items: exclusiveItems, subtotal, taxAmount: round2(total - subtotal), total };
  }
  const cleanItems = items.map((i) => ({ ...i, rate: round2(i.rate) }));
  const subtotal = round2(cleanItems.reduce((sum, i) => sum + i.quantity * i.rate, 0));
  const taxAmount = round2((subtotal * taxRate) / 100);
  return { items: cleanItems, subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}
