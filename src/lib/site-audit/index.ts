import { analyzeSite } from "./analyze";
import { generateAiReport } from "./ai";
import { buildFunnel, extractContent } from "./content";
import { fetchMobileScreenshot, fetchThumScreenshot } from "./screenshot";
import type { AuditCategory, AuditCheck, AuditReport, VideoScene } from "./types";

const CATEGORY_WEIGHTS: Record<string, number> = {
  security: 1.2,
  performance: 1.3,
  seo: 1.2,
  mobile: 1.3,
  accessibility: 0.7,
  conversion: 1.3,
  technology: 0.8,
};

function gradeFor(score: number): AuditReport["grade"] {
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function worstIssues(categories: AuditCategory[], n: number): (AuditCheck & { category: string })[] {
  return categories
    .flatMap((c) => c.checks.filter((k) => k.status === "fail" || k.status === "warn").map((k) => ({ ...k, category: c.name })))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "fail" ? -1 : 1) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, n);
}

// Checks about how the site appears on Google (not visible on the page),
// and about things that are absent from the page.
const GOOGLE_CHECKS = new Set(["title", "meta-description", "structured-data", "social-preview", "indexable", "canonical"]);
const MISSING_CHECKS = new Set(["cta", "contact-form", "phone", "whatsapp", "social-proof", "tap-to-call", "privacy", "social-links", "email"]);

// Used when no ANTHROPIC_API_KEY is configured (or the AI call fails), so the
// video still works — a structured script built from the findings.
export function templateScript(
  report: Pick<AuditReport, "domain" | "overallScore" | "grade" | "categories" | "content" | "funnel">
): VideoScene[] {
  const { domain, overallScore, content, funnel } = report;
  const issues = worstIssues(report.categories, 3);
  const weakest = [...funnel].sort((a, b) => a.score - b.score)[0];
  const missingBof = funnel.find((f) => f.id === "bof")!.items.filter((i) => i.status === "no").map((i) => i.label.toLowerCase());
  const short = (t: string, n = 70) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  const store = content.siteType === "store";

  const scenes: VideoScene[] = [
    {
      kind: "intro",
      title: "An honest look at what's costing you customers",
      narration: `So, I went through ${domain} the way your customers do. On their phone, on Google, and at that moment they decide whether to ${store ? "buy" : "contact you"} or not. It scored ${overallScore} out of 100. Let me show you why.`,
      focus: 0,
      bullets: [],
    },
    {
      kind: "mobile",
      title: "The first three seconds on a phone",
      narration: `Most of your visitors are on their phone. And this is exactly what they see before they scroll. You've got about three seconds here. Do they get what you offer, and how to reach you? ${missingBof.includes("tap-to-call") ? (store ? "The buy button is right there, and that's good. But is there a reason to trust you before they scroll?" : "Right now, they can't even call you in one tap.") : "Every bit of this screen has to earn its place."}`,
      focus: 0,
      bullets: [],
    },
    {
      kind: "headline",
      title: "Your headline",
      narration: content.heroHeadline
        ? `Now look at your headline. ${short(content.heroHeadline, 90)}. Here's the thing: a great headline says who you help and what they get, in under ten words. This one needs to work a lot harder.`
        : "Here's the first problem. There's no clear headline. Someone lands on your site and has to guess what you do. And when people have to guess, they leave.",
      focus: 0.02,
      currentHeadline: content.heroHeadline ?? "",
      rewrite: "",
      bullets: [],
    },
    {
      kind: "funnel",
      title: "How the site converts visitors",
      narration: `Think of your website as a funnel. At the top, people find you. In the middle, they start to trust you. At the bottom, they ${store ? "buy" : "call or enquire"}. Your weakest spot is the ${weakest.name.toLowerCase()}, at just ${weakest.score} out of 100. That's where you're losing ${store ? "sales" : "customers"}.`,
      focus: 0.3,
      bullets: [],
    },
    {
      kind: "proof",
      title: "Proof that others trust you",
      narration: !content.testimonials.length && content.proofSection
        ? "You've got a results section, with videos and screenshots. That's great. But there isn't one written review with a real name that a buyer can quickly read. And that's what tips a doubtful buyer over the edge."
        : content.testimonials.length
        ? `Good news, you do have testimonials. But they're easy to miss, and they don't have real names or ratings. And nine out of ten people check reviews before they buy. So let's make them count.`
        : "Now, where's the proof? There isn't a single testimonial here. Nine out of ten people read reviews before they buy. Without them, even a great business looks like a gamble.",
      focus: 0.6,
      quote: content.testimonials[0] ?? "",
      bullets: [],
    },
  ];
  issues.forEach((issue, i) => {
    // Title with the problem itself ("No tap-to-call link"), not the check name.
    const problem = issue.detail.split(/ — |\. /)[0].replace(/\.$/, "");
    // Only spotlight the page for things you can actually see there.
    const visual = GOOGLE_CHECKS.has(issue.id) ? "google" : MISSING_CHECKS.has(issue.id) ? "missing" : issue.id === "copyright" ? "page" : "none";
    scenes.push({
      kind: "issue",
      title: problem.length <= 48 ? problem : issue.title,
      narration: `${issue.detail} ${issue.impact ?? ""}`.trim(),
      focus: issue.id === "copyright" ? 0.96 : Math.min(1, 0.35 + (i * 0.6) / Math.max(issues.length, 1)),
      span: issue.id === "copyright" ? 0.04 : undefined,
      visual,
      bullets: [issue.impact ?? "", issue.fix ? `Fix: ${issue.fix}` : ""].filter(Boolean).map((b) => (b.length > 110 ? b.slice(0, 107) + "…" : b)),
    });
  });
  scenes.push({
    kind: "outro",
    title: "Every one of these is fixable",
    narration: `And honestly? None of this is hard to fix. A sharper headline, real proof, and ${store ? "a reason to trust you before they scroll" : "one easy way to reach you from any phone"}. Do that, and ${domain} starts turning a lot more visitors into ${store ? "buyers" : "customers"}.`,
    focus: 1,
    bullets: [],
  });
  return scenes;
}

export async function runAudit(url: string): Promise<AuditReport> {
  const warnings: string[] = [];
  const analysis = await analyzeSite(url);
  const target = analysis.finalUrl;

  const [screenshot, mobileScreenshot] = await Promise.all([fetchThumScreenshot(target), fetchMobileScreenshot(target)]);
  const screenshotSource: AuditReport["screenshotSource"] = screenshot || mobileScreenshot ? "thum.io" : null;
  if (!screenshot) warnings.push("Couldn't capture a screenshot of the site — the video will use title cards only.");
  if (!mobileScreenshot) warnings.push("Couldn't capture the mobile view of the site.");

  const categories = analysis.categories;
  const content = extractContent(analysis.html, target);
  const funnel = buildFunnel(content, categories);
  let weighted = 0;
  let totalWeight = 0;
  for (const c of categories) {
    weighted += c.score * CATEGORY_WEIGHTS[c.id];
    totalWeight += CATEGORY_WEIGHTS[c.id];
  }
  const overallScore = Math.round(weighted / totalWeight);
  const domain = new URL(target).hostname.replace(/^www\./, "");

  const base = { domain, overallScore, grade: gradeFor(overallScore), categories, content, funnel };

  let ai: AuditReport["ai"] = null;
  let aiError: string | null = null;
  let videoScript = templateScript(base);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await generateAiReport({
        url: target,
        pageTitle: analysis.pageTitle,
        overallScore,
        categories,
        screenshot,
        mobileScreenshot,
        content,
        funnel,
        textExcerpt: analysis.textExcerpt,
      });
      ai = result.summary;
      if (result.scenes.length) videoScript = result.scenes;
    } catch (err) {
      console.error("AI report failed", err);
      aiError = err instanceof Error ? err.message : "AI report failed";
    }
  } else {
    aiError = "Add ANTHROPIC_API_KEY to get an AI-written report and a tailored video script.";
  }

  return {
    url,
    finalUrl: target,
    fetchedAt: new Date().toISOString(),
    responseTimeMs: analysis.responseTimeMs,
    pageTitle: analysis.pageTitle,
    ...base,
    screenshot,
    mobileScreenshot,
    screenshotSource,
    ai,
    aiError,
    videoScript,
    warnings,
  };
}
