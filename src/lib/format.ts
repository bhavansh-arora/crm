export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function relativeTime(date: Date | string): string {
  const d = new Date(date).getTime();
  const now = Date.now();
  const diffMs = d - now;
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  return rtf.format(diffDay, "day");
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function durationSince(date: Date | string): string {
  const days = daysBetween(date, new Date());
  if (days === 0) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Shows just the domain from a lead's website field, e.g. "https://www.google.com/abc?x=1" -> "www.google.com/"
export function formatWebsiteDisplay(website: string): string {
  const host = website.trim().replace(/^https?:\/\//i, "").split("/")[0];
  return `${host}/`;
}

// "YYYY-MM-DDTHH:mm" in the *viewer's* local time, suitable for a
// datetime-local input's value or min attribute. toISOString() (used
// elsewhere for defaults) gives UTC, which datetime-local misreads as local
// time -- fine-looking but wrong the moment the viewer isn't in UTC.
export function toDateTimeLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowForDateTimeLocalInput(): string {
  return toDateTimeLocalInput(new Date());
}

// A lead's website is often stored without a protocol (e.g. "example.com"),
// which a bare href would treat as a relative link instead of an external
// one -- this makes sure it always opens the actual site.
export function websiteHref(website: string): string {
  const trimmed = website.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Displays a "YYYY-MM-DD" key (already bucketed by IST on the server) as a
// readable date without re-running it through the viewer's own timezone.
export function formatDayKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
}
