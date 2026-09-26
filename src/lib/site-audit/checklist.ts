import type { AuditReport } from "./types";

// What a phone visitor needs to see before scrolling. Combines the
// automated checks with the AI's read of the mobile screenshot (when it
// flags something as missing from the first screen, that wins).
export function mobileChecklist(report: Pick<AuditReport, "categories" | "content" | "ai">): { label: string; ok: boolean }[] {
  const check = (id: string) => report.categories.flatMap((c) => c.checks).find((k) => k.id === id)?.status === "pass";
  const missing = (report.ai?.mobileFirstImpression.missingAboveFold ?? []).join(" ").toLowerCase();
  const { content } = report;
  return [
    { label: "A clear headline", ok: !!content.heroHeadline && !/headline|value prop/.test(missing) },
    { label: "A call-to-action button", ok: content.ctas.length > 0 && !/call-to-action|\bcta\b|book(ing)? button|enquiry button/.test(missing) },
    { label: "One-tap calling", ok: check("tap-to-call") && !/call button|phone|tap-to-call/.test(missing) },
    { label: "WhatsApp chat", ok: check("whatsapp") && !/whatsapp/.test(missing) },
    { label: "A reason to trust you", ok: (content.trustSignals.length > 0 || content.testimonials.length > 0) && !/trust|review|testimonial|rating/.test(missing) },
  ];
}
