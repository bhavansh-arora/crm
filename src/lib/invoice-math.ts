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

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

// Indian numbering (lakh/crore), e.g. 123456.5 ->
// "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only"
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 100 ? belowThousand(crore) : belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${paise ? ` and ${belowHundred(paise)} Paise` : ""} Only`;
}
