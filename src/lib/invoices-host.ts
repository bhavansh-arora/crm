// The same app is also served at invoices.codebunny.net (a second Caddy
// site block pointing at the same container). On that hostname it behaves
// like a standalone invoicing site: invoice-branded login page, "/" goes
// to the invoice dashboard, only invoice pages in the nav, and the CRM's
// other pages redirect back to /invoices. Any hostname starting with
// "invoices." counts, so e.g. invoices.localhost works for local testing.
export function isInvoicesHost(host: string | null | undefined): boolean {
  return Boolean(host && host.toLowerCase().startsWith("invoices."));
}
