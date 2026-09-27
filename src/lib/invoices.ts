import { mkdir, readFile, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import { Prisma, type Invoice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-auth";
import { normalizePhone } from "@/lib/duplicate-lead";
import { getPayment, isRazorpayConfigured, listPayments, type RazorpayPayment } from "@/lib/razorpay";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { computeTotals, round2, type InvoiceItem } from "@/lib/invoice-math";

export { getCompanyDetails, getPublicCompanyDetails } from "@/lib/invoice-pdf";

// Invoices are stored twice: as rows in the database (the source of truth,
// used by the UI) and as files on the server's disk under INVOICE_DIR --
// one PDF per invoice plus a register.csv per month and per financial year,
// laid out as:
//
//   invoices/FY2026-27/register.csv
//   invoices/FY2026-27/2026-09/register.csv
//   invoices/FY2026-27/2026-09/CB_2026-27_0001.pdf
//
// Docker-mounted at /app/invoices in production (like /app/uploads), so the
// files survive redeploys and are included in deploy/backup-db.sh's backup.
// Disk writes are best-effort: a failure is logged, never fails the invoice
// (the PDF route re-renders a missing file on demand).
export const INVOICE_DIR = process.env.INVOICE_DIR || path.join(process.cwd(), "invoices");

export const INVOICE_STATUSES = ["PAID", "UNPAID", "CANCELLED"] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];
export type InvoiceSource = "MANUAL" | "RAZORPAY";


const INVOICE_PREFIX = process.env.INVOICE_PREFIX || "CB";

export function defaultTaxRate(): number {
  const rate = Number(process.env.INVOICE_DEFAULT_TAX_RATE || 0);
  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

// ---------------------------------------------------------------------------
// Dates. Everything is bucketed in IST, same as the rest of the app, so an
// invoice issued at 1 AM IST on the 1st lands in the new month even though
// it's still the previous day in UTC.
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istParts(date: Date) {
  const t = new Date(date.getTime() + IST_OFFSET_MS);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function istMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

// Indian financial year (April-March), e.g. any date from 1 Apr 2026 to
// 31 Mar 2027 -> "2026-27".
export function financialYearOf(date: Date): string {
  const { year, month } = istParts(date);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function monthKeyOf(date: Date): string {
  const { year, month } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function istDateKey(date: Date): string {
  const { year, month, day } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const FY_KEY_RE = /^\d{4}-\d{2}$/;

export function monthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = istMidnight(year, month, 1);
  const end = month === 12 ? istMidnight(year + 1, 1, 1) : istMidnight(year, month + 1, 1);
  return { start, end };
}

export function financialYearRange(fy: string): { start: Date; end: Date } {
  const startYear = Number(fy.slice(0, 4));
  return { start: istMidnight(startYear, 4, 1), end: istMidnight(startYear + 1, 4, 1) };
}

// "YYYY-MM-DD" is taken as that day in IST; anything else is parsed as a
// full timestamp.
export function parseInvoiceDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m ? istMidnight(Number(m[1]), Number(m[2]), Number(m[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new InvoiceError(400, "Invalid invoice date");
  return date;
}

// ---------------------------------------------------------------------------
// Validation + totals
// ---------------------------------------------------------------------------

export class InvoiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

// Used by the admin "New invoice" form (and, internally, Razorpay imports).
export const invoiceInputSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(200),
  customerEmail: z
    .string()
    .trim()
    .email("Invalid customer email")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => v || null),
  customerPhone: optionalText(40),
  customerAddress: optionalText(500),
  customerGstin: optionalText(20),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Every line item needs a description").max(300),
        quantity: z.coerce.number().positive("Quantity must be greater than 0"),
        rate: z.coerce.number().min(0, "Rate can't be negative"),
      })
    )
    .min(1, "Add at least one line item")
    .max(100),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  // true = the rates entered already include tax (tax is backed out of them)
  taxInclusive: z.boolean().optional().default(false),
  invoiceDate: z.string().optional().nullable(),
  status: z.enum(["PAID", "UNPAID"]).optional().default("PAID"),
  paymentMethod: optionalText(100),
  notes: optionalText(1000),
  leadId: z.string().optional().nullable(),
});

export type InvoiceInput = z.input<typeof invoiceInputSchema>;

// ---------------------------------------------------------------------------
// Creating invoices
// ---------------------------------------------------------------------------

type CreateMeta = {
  source: InvoiceSource;
  createdById?: string | null;
  razorpayPaymentId?: string | null;
  currency?: string;
};

export async function createInvoice(rawInput: InvoiceInput, meta: CreateMeta): Promise<Invoice> {
  const input = invoiceInputSchema.parse(rawInput);
  const invoiceDate = input.invoiceDate ? parseInvoiceDate(input.invoiceDate) : new Date();
  const taxRate = input.taxRate ?? defaultTaxRate();
  const totals = computeTotals(input.items, taxRate, input.taxInclusive);
  if (totals.total <= 0) throw new InvoiceError(400, "Invoice total must be greater than 0");

  if (input.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true } });
    if (!lead) throw new InvoiceError(400, "Lead not found");
  }

  const financialYear = financialYearOf(invoiceDate);

  // The counter bump and the invoice insert share a transaction, so a failed
  // insert (e.g. a duplicate Razorpay payment) rolls the number back too.
  const invoice = await prisma.$transaction(async (tx) => {
    const counter = await tx.invoiceCounter.upsert({
      where: { financialYear },
      create: { financialYear, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
    });
    const sequence = counter.lastSequence;
    return tx.invoice.create({
      data: {
        invoiceNumber: `${INVOICE_PREFIX}/${financialYear}/${String(sequence).padStart(4, "0")}`,
        financialYear,
        sequence,
        invoiceDate,
        source: meta.source,
        status: input.status,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress,
        customerGstin: input.customerGstin,
        items: totals.items,
        subtotal: totals.subtotal,
        taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        currency: meta.currency || "INR",
        paymentMethod: input.paymentMethod,
        razorpayPaymentId: meta.razorpayPaymentId || null,
        notes: input.notes,
        leadId: input.leadId || null,
        createdById: meta.createdById || null,
      },
    });
  });

  return saveInvoiceFiles(invoice);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function paymentNote(payment: RazorpayPayment, keys: string[]): string | null {
  if (!payment.notes || Array.isArray(payment.notes)) return null;
  for (const key of keys) {
    const value = (payment.notes as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// Idempotent: a payment that already has an invoice returns that invoice
// with created=false instead of issuing a second one, so the webhook, the
// scheduled sync and the "Sync from Razorpay" button can all safely see
// the same payment.
export async function createInvoiceFromRazorpayPayment(
  payment: RazorpayPayment,
  opts: { createdById?: string | null; leadId?: string | null; source?: InvoiceSource } = {}
): Promise<{ invoice: Invoice; created: boolean }> {
  const existing = await prisma.invoice.findUnique({ where: { razorpayPaymentId: payment.id } });
  if (existing) {
    if (opts.leadId && !existing.leadId) {
      const updated = await prisma.invoice.update({ where: { id: existing.id }, data: { leadId: opts.leadId } });
      return { invoice: updated, created: false };
    }
    return { invoice: existing, created: false };
  }
  if (payment.status !== "captured" && payment.status !== "refunded") {
    throw new InvoiceError(400, `Payment ${payment.id} is "${payment.status}", not captured -- no invoice created`);
  }

  // Customer name: from the payment's notes if the checkout collected one,
  // else the CRM lead with the same email/phone, else the email itself.
  let leadId = opts.leadId || null;
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : await findLeadForPayment(payment.email, payment.contact);
  if (lead) leadId = lead.id;

  const customerName =
    paymentNote(payment, ["name", "customer_name", "full_name", "Name"]) ||
    lead?.name ||
    payment.email ||
    payment.contact ||
    "Customer";

  const total = payment.amount / 100;
  try {
    const invoice = await createInvoice(
      {
        customerName,
        customerEmail: payment.email && payment.email !== "void@razorpay.com" ? payment.email : null,
        customerPhone: payment.contact || lead?.phone || null,
        customerAddress: paymentNote(payment, ["address", "billing_address"]),
        customerGstin: paymentNote(payment, ["gstin", "GSTIN", "gst"]),
        items: [{ description: payment.description || "Payment received", quantity: 1, rate: total }],
        // Razorpay amounts are what the customer actually paid, so any tax is
        // already included in them.
        taxInclusive: true,
        invoiceDate: new Date(payment.created_at * 1000).toISOString(),
        status: "PAID",
        paymentMethod: `Razorpay (${payment.method})`,
        leadId,
      },
      {
        source: opts.source || "RAZORPAY",
        createdById: opts.createdById,
        razorpayPaymentId: payment.id,
        currency: payment.currency,
      }
    );
    return { invoice, created: true };
  } catch (error) {
    // Two callers (e.g. webhook + the scheduled sync) raced on the same payment.
    if (isUniqueViolation(error)) {
      const invoice = await prisma.invoice.findUnique({ where: { razorpayPaymentId: payment.id } });
      if (invoice) return { invoice, created: false };
    }
    throw error;
  }
}

async function findLeadForPayment(email: string | null, contact: string | null) {
  if (email && email !== "void@razorpay.com") {
    const lead = await prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (lead) return lead;
  }
  const normalized = normalizePhone(contact);
  if (!normalized) return null;
  // Phones are stored in whatever format they were entered in, so narrow
  // down on the last few digits, then confirm with the full normalization.
  const candidates = await prisma.lead.findMany({ where: { phone: { contains: normalized.slice(-4) } } });
  return candidates.find((l) => normalizePhone(l.phone) === normalized) || null;
}

// ---------------------------------------------------------------------------
// Status changes -- invoices are never edited or deleted once issued.
// ---------------------------------------------------------------------------

export async function setInvoiceStatus(id: string, status: InvoiceStatusValue): Promise<Invoice> {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new InvoiceError(404, "Invoice not found");
  if (invoice.status === "CANCELLED") throw new InvoiceError(400, "This invoice is cancelled and can't be changed");

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status, cancelledAt: status === "CANCELLED" ? new Date() : null },
  });
  return saveInvoiceFiles(updated);
}

// ---------------------------------------------------------------------------
// Files on disk
// ---------------------------------------------------------------------------

function invoiceRelativePath(invoice: Pick<Invoice, "financialYear" | "invoiceDate" | "invoiceNumber">): string {
  const filename = `${invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
  return path.join(`FY${invoice.financialYear}`, monthKeyOf(invoice.invoiceDate), filename);
}

async function saveInvoiceFiles(invoice: Invoice): Promise<Invoice> {
  let result = invoice;
  try {
    const relative = invoiceRelativePath(invoice);
    const pdf = await renderInvoicePdf(invoice);
    await mkdir(path.dirname(path.join(INVOICE_DIR, relative)), { recursive: true });
    await writeFile(path.join(INVOICE_DIR, relative), pdf);
    if (invoice.pdfPath !== relative) {
      result = await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: relative } });
    }
  } catch (error) {
    console.error(`Could not save PDF for invoice ${invoice.invoiceNumber}:`, error);
  }
  await writeRegisters(invoice.financialYear, monthKeyOf(invoice.invoiceDate));
  return result;
}

// Returns the invoice's PDF from disk, re-rendering (and re-saving) it if
// the file is missing -- e.g. a fresh server, or a platform like Vercel
// whose disk doesn't persist.
export async function getInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const relative = invoiceRelativePath(invoice);
  try {
    return await readFile(path.join(INVOICE_DIR, relative));
  } catch {
    const pdf = Buffer.from(await renderInvoicePdf(invoice));
    try {
      await mkdir(path.dirname(path.join(INVOICE_DIR, relative)), { recursive: true });
      await writeFile(path.join(INVOICE_DIR, relative), pdf);
    } catch (error) {
      console.error(`Could not save PDF for invoice ${invoice.invoiceNumber}:`, error);
    }
    return pdf;
  }
}

async function writeRegisters(financialYear: string, monthKey: string) {
  try {
    const fyDir = path.join(INVOICE_DIR, `FY${financialYear}`);
    await mkdir(path.join(fyDir, monthKey), { recursive: true });
    const [monthInvoices, fyInvoices] = await Promise.all([
      findInvoicesForPeriod({ month: monthKey }),
      findInvoicesForPeriod({ fy: financialYear }),
    ]);
    await writeFile(path.join(fyDir, monthKey, "register.csv"), invoicesToCsv(monthInvoices));
    await writeFile(path.join(fyDir, "register.csv"), invoicesToCsv(fyInvoices));
  } catch (error) {
    console.error(`Could not write invoice registers for FY${financialYear}/${monthKey}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Queries, registers and summaries
// ---------------------------------------------------------------------------

export type PeriodFilter = { month?: string | null; fy?: string | null };

export function periodWhere(filter: PeriodFilter): Prisma.InvoiceWhereInput {
  if (filter.month) {
    if (!MONTH_KEY_RE.test(filter.month)) throw new InvoiceError(400, "month must look like 2026-09");
    const { start, end } = monthRange(filter.month);
    return { invoiceDate: { gte: start, lt: end } };
  }
  if (filter.fy) {
    if (!FY_KEY_RE.test(filter.fy)) throw new InvoiceError(400, "fy must look like 2026-27");
    return { financialYear: filter.fy };
  }
  return {};
}

export function findInvoicesForPeriod(filter: PeriodFilter) {
  return prisma.invoice.findMany({
    where: periodWhere(filter),
    orderBy: [{ invoiceDate: "asc" }, { sequence: "asc" }],
  });
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function invoicesToCsv(invoices: Invoice[]): string {
  const header = [
    "Invoice Number",
    "Invoice Date",
    "Status",
    "Source",
    "Customer",
    "Email",
    "Phone",
    "Customer GSTIN",
    "Description",
    "Subtotal",
    "Tax Rate %",
    "Tax",
    "Total",
    "Currency",
    "Payment Method",
    "Razorpay Payment ID",
  ];
  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    istDateKey(inv.invoiceDate),
    inv.status,
    inv.source,
    inv.customerName,
    inv.customerEmail,
    inv.customerPhone,
    inv.customerGstin,
    (inv.items as InvoiceItem[]).map((i) => i.description).join("; "),
    inv.subtotal.toFixed(2),
    inv.taxRate,
    inv.taxAmount.toFixed(2),
    inv.total.toFixed(2),
    inv.currency,
    inv.paymentMethod,
    inv.razorpayPaymentId,
  ]);
  const active = invoices.filter((i) => i.status !== "CANCELLED");
  const sum = (key: "subtotal" | "taxAmount" | "total") => active.reduce((s, i) => s + i[key], 0).toFixed(2);
  rows.push([]);
  rows.push([
    `TOTAL (${active.length} invoices, excluding cancelled)`,
    "", "", "", "", "", "", "", "",
    sum("subtotal"), "", sum("taxAmount"), sum("total"),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export type PeriodTotals = {
  count: number;
  paidCount: number;
  unpaidCount: number;
  cancelledCount: number;
  subtotal: number;
  tax: number;
  total: number;
  paidTotal: number;
};

export type InvoiceSummary = (PeriodTotals & {
  financialYear: string;
  months: (PeriodTotals & { month: string })[];
})[];

function emptyTotals(): PeriodTotals {
  return { count: 0, paidCount: 0, unpaidCount: 0, cancelledCount: 0, subtotal: 0, tax: 0, total: 0, paidTotal: 0 };
}

function addToTotals(t: PeriodTotals, inv: Pick<Invoice, "status" | "subtotal" | "taxAmount" | "total">) {
  if (inv.status === "CANCELLED") {
    t.cancelledCount += 1;
    return;
  }
  t.count += 1;
  t.subtotal = round2(t.subtotal + inv.subtotal);
  t.tax = round2(t.tax + inv.taxAmount);
  t.total = round2(t.total + inv.total);
  if (inv.status === "PAID") {
    t.paidCount += 1;
    t.paidTotal = round2(t.paidTotal + inv.total);
  } else {
    t.unpaidCount += 1;
  }
}

// Yearly (financial year) and monthly totals, newest first. Cancelled
// invoices are counted separately and left out of every amount.
export async function getInvoiceSummary(): Promise<InvoiceSummary> {
  const invoices = await prisma.invoice.findMany({
    select: { financialYear: true, invoiceDate: true, status: true, subtotal: true, taxAmount: true, total: true },
  });

  const years = new Map<string, { totals: PeriodTotals; months: Map<string, PeriodTotals> }>();
  for (const inv of invoices) {
    let year = years.get(inv.financialYear);
    if (!year) {
      year = { totals: emptyTotals(), months: new Map() };
      years.set(inv.financialYear, year);
    }
    const key = monthKeyOf(inv.invoiceDate);
    let month = year.months.get(key);
    if (!month) {
      month = emptyTotals();
      year.months.set(key, month);
    }
    addToTotals(year.totals, inv);
    addToTotals(month, inv);
  }

  return [...years.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([financialYear, y]) => ({
      financialYear,
      ...y.totals,
      months: [...y.months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, totals]) => ({ month, ...totals })),
    }));
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

export function invoiceErrorResponse(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    const issue = error.errors[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json({ error: `${where}${issue.message}` }, { status: 400 });
  }
  if (error instanceof InvoiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return handleApiError(error);
}

export function listInvoicesWhere(params: URLSearchParams): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = periodWhere({ month: params.get("month"), fy: params.get("fy") });
  const status = params.get("status");
  if (status) {
    if (!(INVOICE_STATUSES as readonly string[]).includes(status)) throw new InvoiceError(400, "Invalid status");
    where.status = status;
  }
  const q = params.get("q")?.trim();
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { razorpayPaymentId: { contains: q } },
    ];
  }
  return where;
}

export const razorpayImportSchema = z.union([
  z.object({ paymentId: z.string().trim().regex(/^pay_[A-Za-z0-9]+$/, "Payment ID should look like pay_XXXXXXXX") }),
  z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  }),
  // The one-click "Sync from Razorpay" button and the scheduled sync.
  z.object({ lastDays: z.number().int().min(1).max(90) }),
]);

export type RazorpayImportResult = {
  created: number;
  skipped: number;
  failed: number;
  results: { paymentId: string; outcome: "created" | "exists" | "failed"; invoiceId?: string; invoiceNumber?: string; error?: string }[];
};

// Issues an invoice for one Razorpay payment, or for every captured payment
// in a date range (inclusive, IST days) or the last N days -- oldest first, so invoice numbers
// follow payment order. Payments that already have an invoice are skipped.
export async function importFromRazorpay(
  rawInput: z.input<typeof razorpayImportSchema>,
  opts: { createdById?: string | null; source?: InvoiceSource } = {}
): Promise<RazorpayImportResult> {
  if (!isRazorpayConfigured()) {
    throw new InvoiceError(400, "Razorpay isn't set up yet -- add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  const input = razorpayImportSchema.parse(rawInput);

  let payments: RazorpayPayment[];
  try {
    if ("paymentId" in input) {
      payments = [await getPayment(input.paymentId)];
    } else if ("lastDays" in input) {
      const to = new Date();
      const from = new Date(to.getTime() - input.lastDays * 24 * 60 * 60 * 1000);
      payments = (await listPayments(from, to))
        .filter((p) => p.status === "captured")
        .sort((a, b) => a.created_at - b.created_at);
    } else {
      const from = parseInvoiceDate(input.from);
      const to = new Date(parseInvoiceDate(input.to).getTime() + 24 * 60 * 60 * 1000 - 1);
      if (to < from) throw new InvoiceError(400, "'to' date is before 'from' date");
      if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
        throw new InvoiceError(400, "Import at most one year at a time");
      }
      payments = (await listPayments(from, to))
        .filter((p) => p.status === "captured")
        .sort((a, b) => a.created_at - b.created_at);
    }
  } catch (error) {
    if (error instanceof InvoiceError) throw error;
    throw new InvoiceError(502, `Razorpay: ${error instanceof Error ? error.message : "request failed"}`);
  }

  const result: RazorpayImportResult = { created: 0, skipped: 0, failed: 0, results: [] };
  for (const payment of payments) {
    try {
      const { invoice, created } = await createInvoiceFromRazorpayPayment(payment, opts);
      if (created) result.created += 1;
      else result.skipped += 1;
      result.results.push({
        paymentId: payment.id,
        outcome: created ? "created" : "exists",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });
    } catch (error) {
      result.failed += 1;
      result.results.push({
        paymentId: payment.id,
        outcome: "failed",
        error: error instanceof Error ? error.message : "Failed",
      });
    }
  }
  return result;
}

export async function registerCsvResponse(params: URLSearchParams): Promise<NextResponse> {
  const month = params.get("month");
  const fy = params.get("fy");
  if (!month && !fy) throw new InvoiceError(400, "Pass ?month=YYYY-MM or ?fy=YYYY-YY");
  const invoices = await findInvoicesForPeriod({ month, fy });
  const name = month ? `invoices-${month}.csv` : `invoices-FY${fy}.csv`;
  return new NextResponse(invoicesToCsv(invoices), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function pdfResponse(invoiceNumber: string, pdf: Buffer, download: boolean): NextResponse {
  const filename = `Invoice-${invoiceNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type InvoiceDashboard = {
  thisMonth: PeriodTotals & { month: string };
  lastMonth: PeriodTotals & { month: string };
  thisYear: PeriodTotals & { financialYear: string };
  unpaid: { count: number; total: number };
  // Last 12 months, oldest first, including months with no invoices.
  months: { month: string; total: number; count: number }[];
  topCustomers: { name: string; total: number; count: number }[];
  recent: Invoice[];
};

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getInvoiceDashboard(): Promise<InvoiceDashboard> {
  const now = new Date();
  const currentMonth = monthKeyOf(now);
  const firstMonth = shiftMonth(currentMonth, -11);
  const fy = financialYearOf(now);
  const fyStart = financialYearRange(fy).start;
  const windowStart = monthRange(firstMonth).start;
  const since = fyStart < windowStart ? fyStart : windowStart;

  const [invoices, unpaidInvoices, recent] = await Promise.all([
    prisma.invoice.findMany({
      where: { invoiceDate: { gte: since }, status: { not: "CANCELLED" } },
      select: { invoiceDate: true, financialYear: true, status: true, subtotal: true, taxAmount: true, total: true, customerName: true },
    }),
    prisma.invoice.findMany({ where: { status: "UNPAID" }, select: { total: true } }),
    prisma.invoice.findMany({ orderBy: [{ invoiceDate: "desc" }, { sequence: "desc" }], take: 6 }),
  ]);

  const thisMonth = { month: currentMonth, ...emptyTotals() };
  const lastMonth = { month: shiftMonth(currentMonth, -1), ...emptyTotals() };
  const thisYear = { financialYear: fy, ...emptyTotals() };
  const monthTotals = new Map<string, { total: number; count: number }>();
  for (let i = 0; i < 12; i++) monthTotals.set(shiftMonth(firstMonth, i), { total: 0, count: 0 });
  const customers = new Map<string, { name: string; total: number; count: number }>();

  for (const inv of invoices) {
    const key = monthKeyOf(inv.invoiceDate);
    if (key === thisMonth.month) addToTotals(thisMonth, inv);
    if (key === lastMonth.month) addToTotals(lastMonth, inv);
    const bucket = monthTotals.get(key);
    if (bucket) {
      bucket.total = round2(bucket.total + inv.total);
      bucket.count += 1;
    }
    if (inv.financialYear === fy) {
      addToTotals(thisYear, inv);
      const id = inv.customerName.trim().toLowerCase();
      const c = customers.get(id) || { name: inv.customerName.trim(), total: 0, count: 0 };
      c.total = round2(c.total + inv.total);
      c.count += 1;
      customers.set(id, c);
    }
  }

  return {
    thisMonth,
    lastMonth,
    thisYear,
    unpaid: {
      count: unpaidInvoices.length,
      total: round2(unpaidInvoices.reduce((s, i) => s + i.total, 0)),
    },
    months: [...monthTotals.entries()].map(([month, v]) => ({ month, ...v })),
    topCustomers: [...customers.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    recent,
  };
}
