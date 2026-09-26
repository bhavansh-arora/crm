import { analyzeSite } from "./analyze";
import { generateAiReport } from "./ai";
import { fetchThumScreenshot } from "./screenshot";
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
// video still works — just with a template script instead of a tailored one.
export function templateScript(report: Pick<AuditReport, "domain" | "overallScore" | "grade" | "categories">): VideoScene[] {
  const issues = worstIssues(report.categories, 5);
  const scenes: VideoScene[] = [
    {
      kind: "intro",
      title: `Website review: ${report.domain}`,
      narration: `Let's take a walk through ${report.domain}. We ran a full audit covering speed, security, Google visibility, mobile experience and how well the site turns visitors into customers. It scored ${report.overallScore} out of 100.`,
      focus: 0,
      bullets: [],
    },
    {
      kind: "walkthrough",
      title: "First impression",
      narration: "This is what a visitor sees first. You have about three seconds to convince them to stay, so the top of the page has to say clearly what you do and how to get in touch.",
      focus: 0,
      bullets: [],
    },
  ];
  issues.forEach((issue, i) => {
    scenes.push({
      kind: "issue",
      title: `${issue.title}: ${issue.status === "fail" ? "failing" : "needs work"}`,
      narration: `${issue.detail} ${issue.impact ?? ""}`.trim(),
      focus: Math.min(1, (i + 1) / (issues.length + 1)),
      bullets: [issue.category, issue.fix ? `Fix: ${issue.fix}` : ""].filter(Boolean).map((b) => (b.length > 110 ? b.slice(0, 107) + "…" : b)),
    });
  });
  scenes.push({
    kind: "outro",
    title: "The good news: it's all fixable",
    narration: `Every one of these problems can be fixed. With a faster, mobile-friendly site that makes it easy to call or enquire, ${report.domain} could be turning far more visitors into paying customers.`,
    focus: 1,
    bullets: [],
  });
  return scenes;
}

export async function runAudit(url: string): Promise<AuditReport> {
  const warnings: string[] = [];
  const analysis = await analyzeSite(url);
  const target = analysis.finalUrl;

  const screenshot = await fetchThumScreenshot(target);
  const screenshotSource: AuditReport["screenshotSource"] = screenshot ? "thum.io" : null;
  if (!screenshot) warnings.push("Couldn't capture a screenshot of the site — the video will use title cards only.");

  const categories = analysis.categories;
  let weighted = 0;
  let totalWeight = 0;
  for (const c of categories) {
    weighted += c.score * CATEGORY_WEIGHTS[c.id];
    totalWeight += CATEGORY_WEIGHTS[c.id];
  }
  const overallScore = Math.round(weighted / totalWeight);
  const domain = new URL(target).hostname.replace(/^www\./, "");

  const base = { domain, overallScore, grade: gradeFor(overallScore), categories };

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
    screenshotSource,
    ai,
    aiError,
    videoScript,
    warnings,
  };
}
