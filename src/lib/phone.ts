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

export function buildWhatsAppUrl(phone: string, message: string): string {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
