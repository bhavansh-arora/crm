// Best-effort conversion of a stored phone number into the digits-only,
// country-code-prefixed format wa.me requires. Numbers in this app are
// mostly 10-digit Indian mobile numbers (sometimes with a leading 0, as
// dialed locally), so a bare 10-digit number gets "91" prepended; anything
// that already looks like it has a country code is left as-is.
export function toWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

export function fillTemplate(body: string, values: { name: string }): string {
  return body.replace(/\{\{\s*name\s*\}\}/gi, values.name);
}

// wa.me only pre-fills text -- there's no way to attach an image file or add
// real interactive/URL buttons without the paid, Meta-approved WhatsApp
// Business API. The closest we can do here: a direct image URL on its own
// line, which WhatsApp auto-expands into a link preview with thumbnail, and
// any plain URL in the text becomes a tappable link on its own (no special
// handling needed for that part).
export function buildWhatsAppMessage(body: string, imageUrl?: string | null): string {
  return imageUrl ? `${body}\n\n${imageUrl}` : body;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// A bare "91"-prefixed number with no "+" isn't a valid dial pattern on
// Indian networks (only a plain 10-digit number or a "+91"-prefixed one
// dials correctly), so the tel: link needs the "+" that toWhatsAppNumber
// deliberately omits (wa.me wants digits only).
export function buildTelHref(phone: string): string {
  return `tel:+${toWhatsAppNumber(phone)}`;
}
