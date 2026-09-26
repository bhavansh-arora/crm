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

  const scenes: VideoScene[] = [
    {
      kind: "intro",
      title: "An honest look at what's costing you customers",
      narration: `This is a review of ${domain}. We examined it the way your customers experience it: on their phones, on Google, and at the moment they decide whether to contact you. It scores ${overallScore} out of 100. Here is what that means.`,
      focus: 0,
      bullets: [],
    },
    {
      kind: "mobile",
      title: "The first three seconds on a phone",
      narration: `Most of your visitors arrive on a mobile phone. This is exactly what they see before they scroll. In these first three seconds, a visitor must understand what you offer and how to reach you. ${missingBof.includes("tap-to-call") ? "Right now, there is no one-tap way to call you." : "Every element on this screen has to earn its place."}`,
      focus: 0,
      bullets: [],
    },
    {
      kind: "headline",
      title: "Your headline",
      narration: content.heroHeadline
        ? `Your main headline reads: ${short(content.heroHeadline, 90)}. A strong headline states who you help and the result you deliver, in under ten words. This one needs to work harder.`
        : "Your homepage has no clear headline. A visitor lands and has to guess what you do. That is the fastest way to lose them.",
      focus: 0.02,
      currentHeadline: content.heroHeadline ?? "",
      rewrite: "",
      bullets: [],
    },
    {
      kind: "funnel",
      title: "How the site converts visitors",
      narration: `A website has three jobs. Top of funnel: get found and grab attention. Middle of funnel: build trust. Bottom of funnel: turn interest into an enquiry. Your weakest stage is the ${weakest.name.toLowerCase()}, scoring ${weakest.score} out of 100. That is where customers are leaking out.`,
      focus: 0.3,
      bullets: [],
    },
    {
      kind: "proof",
      title: "Proof that others trust you",
      narration: content.testimonials.length
        ? `You do have testimonials, and that matters. But they need to be specific, visible, and backed by real names and ratings. Ninety percent of customers read reviews before they buy.`
        : "There are no testimonials on this page. Ninety percent of customers read reviews before they buy. Without proof, even a great business looks like a risk.",
      focus: 0.6,
      quote: content.testimonials[0] ?? "",
      bullets: [],
    },
  ];
  issues.forEach((issue, i) => {
    // Title with the problem itself ("No tap-to-call link"), not the check name.
    const problem = issue.detail.split(/ — |\. /)[0].replace(/\.$/, "");
    scenes.push({
      kind: "issue",
      title: problem.length <= 48 ? problem : issue.title,
      narration: `${issue.detail} ${issue.impact ?? ""}`.trim(),
      focus: Math.min(1, 0.35 + (i * 0.6) / Math.max(issues.length, 1)),
      bullets: [issue.impact ?? "", issue.fix ? `Fix: ${issue.fix}` : ""].filter(Boolean).map((b) => (b.length > 110 ? b.slice(0, 107) + "…" : b)),
    });
  });
  scenes.push({
    kind: "outro",
    title: "Every one of these is fixable",
    narration: `None of this is permanent. With a sharper headline, visible proof, and a clear way to enquire from any phone, ${domain} can turn far more of its visitors into paying customers.`,
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
