import { readFile } from "fs/promises";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import type { Invoice } from "@prisma/client";
import { amountInWords } from "@/lib/invoice-math";

// Business details printed on every invoice, from env (see .env.example).
// INVOICE_COMPANY_ADDRESS can span lines with "|" or a literal "\n".
export function getCompanyDetails() {
  return {
    name: process.env.INVOICE_COMPANY_NAME || "CodeBunny",
    address: process.env.INVOICE_COMPANY_ADDRESS || "A8, Flower Valley, VIP Road|Raipur - 492001",
    gstin: process.env.INVOICE_COMPANY_GSTIN || "",
    email: process.env.INVOICE_COMPANY_EMAIL || "info@codebunny.net",
    phone: process.env.INVOICE_COMPANY_PHONE || "",
    website: process.env.INVOICE_COMPANY_WEBSITE || "",
    logoPath: process.env.INVOICE_LOGO_PATH || "",
    footer: process.env.INVOICE_FOOTER || "Thank you for your business!",
  };
}

type Item = { description: string; quantity: number; rate: number };

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const RIGHT = PAGE_WIDTH - MARGIN;

const BRAND = rgb(0.184, 0.337, 0.82); // brand-600
const TEXT = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.85, 0.87, 0.9);
const HEADER_BG = rgb(0.94, 0.96, 1);

// pdf-lib's built-in fonts only cover WinAnsi (roughly Latin-1), and throw
// on anything else -- so the rupee sign, emoji, Devanagari etc. in customer
// data are swapped out rather than failing the whole invoice.
function clean(text: string | null | undefined): string {
  return (text || "")
    .replace(/₹/g, "Rs.")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\t/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/gu, "?");
}

function splitLines(text: string): string[] {
  return clean(text.replace(/\\n/g, "\n"))
    .split(/\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A single word longer than the column (e.g. a URL) is hard-broken.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

function money(n: number): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatInvoiceDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

async function loadLogo(pdf: PDFDocument, logoPath: string): Promise<PDFImage | null> {
  if (!logoPath) return null;
  try {
    const bytes = await readFile(logoPath);
    return /\.png$/i.test(logoPath) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch (error) {
    console.error(`Could not load invoice logo at ${logoPath}:`, error);
    return null;
  }
}

export async function renderInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const company = getCompanyDetails();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.invoiceNumber}`);
  pdf.setAuthor(company.name);
  pdf.setCreator(company.name);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdf, company.logoPath);

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const text = (s: string, x: number, yPos: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) =>
    page.drawText(clean(s), { x, y: yPos, size: opts.size ?? 10, font: opts.font ?? regular, color: opts.color ?? TEXT });
  const textRight = (s: string, xRight: number, yPos: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    text(s, xRight - font.widthOfTextAtSize(clean(s), size), yPos, opts);
  };
  const hr = (yPos: number) =>
    page.drawLine({ start: { x: MARGIN, y: yPos }, end: { x: RIGHT, y: yPos }, thickness: 0.75, color: LINE });

  // ---- Header: business details (left), invoice meta (right) ----
  let leftY = y;
  if (logo) {
    const h = 44;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: MARGIN, y: leftY - h, width: w, height: h });
    leftY -= h + 10;
  }
  text(company.name, MARGIN, leftY - 18, { size: 20, font: bold, color: BRAND });
  leftY -= 34;
  const companyLines = [
    ...splitLines(company.address),
    company.gstin ? `GSTIN: ${company.gstin}` : "",
    company.email ? `Email: ${company.email}` : "",
    company.phone ? `Phone: ${company.phone}` : "",
    company.website,
  ].filter(Boolean);
  for (const line of companyLines) {
    text(line, MARGIN, leftY, { size: 9, color: MUTED });
    leftY -= 12;
  }

  const title = invoice.taxRate > 0 ? "TAX INVOICE" : "INVOICE";
  textRight(title, RIGHT, y - 18, { size: 18, font: bold });
  let rightY = y - 38;
  const meta: [string, string][] = [
    ["Invoice No.", invoice.invoiceNumber],
    ["Invoice Date", formatInvoiceDate(invoice.invoiceDate)],
    ["Status", invoice.status],
  ];
  for (const [label, value] of meta) {
    textRight(value, RIGHT, rightY, { size: 10, font: bold });
    textRight(label, RIGHT - bold.widthOfTextAtSize(clean(value), 10) - 10, rightY, { size: 9, color: MUTED });
    rightY -= 14;
  }

  y = Math.min(leftY, rightY) - 8;
  hr(y);
  y -= 20;

  // ---- Bill to ----
  text("BILL TO", MARGIN, y, { size: 8, font: bold, color: MUTED });
  y -= 15;
  text(invoice.customerName, MARGIN, y, { size: 12, font: bold });
  y -= 14;
  const customerLines = [
    ...(invoice.customerAddress ? wrap(invoice.customerAddress, regular, 9, 300) : []),
    invoice.customerEmail || "",
    invoice.customerPhone || "",
    invoice.customerGstin ? `GSTIN: ${invoice.customerGstin}` : "",
  ].filter(Boolean);
  for (const line of customerLines) {
    text(line, MARGIN, y, { size: 9, color: MUTED });
    y -= 12;
  }
  y -= 12;

  // ---- Line items ----
  const COL_NUM = MARGIN + 6;
  const COL_DESC = MARGIN + 28;
  const DESC_WIDTH = 270;
  const COL_QTY_R = 395;
  const COL_RATE_R = 475;
  const COL_AMT_R = RIGHT - 6;

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 7, width: RIGHT - MARGIN, height: 22, color: HEADER_BG });
    text("#", COL_NUM, y, { size: 9, font: bold });
    text("Description", COL_DESC, y, { size: 9, font: bold });
    textRight("Qty", COL_QTY_R, y, { size: 9, font: bold });
    textRight("Rate", COL_RATE_R, y, { size: 9, font: bold });
    textRight(`Amount (${invoice.currency})`, COL_AMT_R, y, { size: 9, font: bold });
    y -= 24;
  };
  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    text(`${company.name}  -  Invoice ${invoice.invoiceNumber} (continued)`, MARGIN, y, { size: 9, color: MUTED });
    y -= 24;
  };

  drawTableHeader();
  const items = invoice.items as Item[];
  items.forEach((item, index) => {
    const descLines = wrap(item.description, regular, 10, DESC_WIDTH);
    const rowHeight = descLines.length * 13 + 14;
    if (y - rowHeight < 110) {
      newPage();
      drawTableHeader();
    }
    text(String(index + 1), COL_NUM, y, { size: 10, color: MUTED });
    descLines.forEach((line, i) => text(line, COL_DESC, y - i * 13, { size: 10 }));
    textRight(String(item.quantity), COL_QTY_R, y);
    textRight(money(item.rate), COL_RATE_R, y);
    textRight(money(item.quantity * item.rate), COL_AMT_R, y);
    hr(y - (descLines.length - 1) * 13 - 8);
    y -= rowHeight;
  });

  // ---- Totals ----
  const totalsNeeded = 150 + (invoice.notes ? 60 : 0);
  if (y - totalsNeeded < 70) newPage();
  y -= 10;
  const LABEL_R = COL_RATE_R;
  const totalRow = (label: string, value: string, strong = false) => {
    textRight(label, LABEL_R, y, { size: strong ? 11 : 10, font: strong ? bold : regular, color: strong ? TEXT : MUTED });
    textRight(value, COL_AMT_R, y, { size: strong ? 11 : 10, font: strong ? bold : regular });
    y -= strong ? 18 : 15;
  };
  totalRow("Subtotal", money(invoice.subtotal));
  if (invoice.taxRate > 0) totalRow(`GST @ ${invoice.taxRate}%`, money(invoice.taxAmount));
  page.drawLine({ start: { x: 330, y: y + 10 }, end: { x: RIGHT, y: y + 10 }, thickness: 0.75, color: LINE });
  y -= 4;
  totalRow("Total", `${invoice.currency} ${money(invoice.total)}`, true);

  if (invoice.currency === "INR") {
    for (const line of wrap(`Amount in words: ${amountInWords(invoice.total)}`, regular, 9, RIGHT - MARGIN)) {
      text(line, MARGIN, y, { size: 9, color: MUTED });
      y -= 12;
    }
  }
  y -= 10;

  // ---- Payment details + notes ----
  const payment = [
    invoice.paymentMethod ? `Payment method: ${invoice.paymentMethod}` : "",
    invoice.razorpayPaymentId ? `Razorpay payment ID: ${invoice.razorpayPaymentId}` : "",
  ].filter(Boolean);
  if (payment.length) {
    text("PAYMENT", MARGIN, y, { size: 8, font: bold, color: MUTED });
    y -= 13;
    for (const line of payment) {
      text(line, MARGIN, y, { size: 9 });
      y -= 12;
    }
    y -= 8;
  }
  if (invoice.notes) {
    text("NOTES", MARGIN, y, { size: 8, font: bold, color: MUTED });
    y -= 13;
    for (const line of wrap(invoice.notes, regular, 9, RIGHT - MARGIN)) {
      if (y < 70) newPage();
      text(line, MARGIN, y, { size: 9 });
      y -= 12;
    }
  }

  // ---- Footer + cancelled stamp on every page ----
  for (const p of pdf.getPages()) {
    page = p;
    hr(56);
    text(company.footer, MARGIN, 42, { size: 9, color: MUTED });
    text("This is a computer-generated invoice and does not require a signature.", MARGIN, 30, { size: 8, color: MUTED });
    if (invoice.status === "CANCELLED") {
      p.drawText("CANCELLED", {
        x: 120,
        y: 300,
        size: 90,
        font: bold,
        color: rgb(0.86, 0.15, 0.15),
        opacity: 0.18,
        rotate: degrees(35),
      });
    }
  }

  return pdf.save();
}

// The same details minus the server-side logo path, safe to pass to the
// browser for the on-screen invoice (src/app/invoices/InvoiceView.tsx).
export function getPublicCompanyDetails() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { logoPath, ...rest } = getCompanyDetails();
  return rest;
}
