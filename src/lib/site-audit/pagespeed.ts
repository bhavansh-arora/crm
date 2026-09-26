import type { PageSpeedResult } from "./types";

// Google PageSpeed Insights: real Lighthouse lab scores plus a full-page
// screenshot. Works without a key at very low volume but is quickly rate
// limited (HTTP 429) — set PAGESPEED_API_KEY (free, from Google Cloud
// Console) for reliable results.

type LighthouseAudit = { numericValue?: number; displayValue?: string; score?: number | null; details?: { screenshot?: { data?: string } } };

const METRICS: { id: string; label: string; good: number; poor: number }[] = [
  { id: "largest-contentful-paint", label: "Largest Contentful Paint", good: 2500, poor: 4000 },
  { id: "first-contentful-paint", label: "First Contentful Paint", good: 1800, poor: 3000 },
  { id: "total-blocking-time", label: "Total Blocking Time", good: 200, poor: 600 },
  { id: "cumulative-layout-shift", label: "Cumulative Layout Shift", good: 0.1, poor: 0.25 },
  { id: "speed-index", label: "Speed Index", good: 3400, poor: 5800 },
];

export async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<{ result: PageSpeedResult; screenshot: string | null } | { error: string }> {
  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) params.append("category", c);
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);

  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      return {
        error:
          res.status === 429
            ? "Google PageSpeed rate limit reached — add a PAGESPEED_API_KEY to get lab speed scores."
            : `Google PageSpeed failed (HTTP ${res.status}).`,
      };
    }
    const data = await res.json();
    const lh = data.lighthouseResult;
    const cat = (k: string): number | null => (lh?.categories?.[k]?.score == null ? null : Math.round(lh.categories[k].score * 100));
    const audits: Record<string, LighthouseAudit> = lh?.audits ?? {};

    const metrics = METRICS.filter((m) => audits[m.id]?.numericValue != null).map((m) => {
      const v = audits[m.id].numericValue!;
      return {
        label: m.label,
        value: audits[m.id].displayValue ?? String(v),
        rating: (v <= m.good ? "good" : v <= m.poor ? "average" : "poor") as "good" | "average" | "poor",
      };
    });

    const screenshot = audits["full-page-screenshot"]?.details?.screenshot?.data ?? null;
    return {
      result: {
        strategy,
        performance: cat("performance"),
        accessibility: cat("accessibility"),
        bestPractices: cat("best-practices"),
        seo: cat("seo"),
        metrics,
      },
      screenshot,
    };
  } catch (err) {
    return { error: `Google PageSpeed didn't respond in time (${err instanceof Error ? err.name : "error"}).` };
  }
}

// Fallback full-page screenshot via thum.io's free tier. Fetched server-side
// and returned as a data: URL so the browser can draw it onto a canvas for
// the video without tainting it (cross-origin images can't be recorded).
export async function fetchThumScreenshot(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://image.thum.io/get/width/1280/crop/7000/noanimate/${url}`, {
      signal: AbortSignal.timeout(60_000),
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return null; // placeholder/error image
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
