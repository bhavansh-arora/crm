export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type Severity = "critical" | "high" | "medium" | "low";

export type AuditCheck = {
  id: string;
  title: string;
  status: CheckStatus;
  severity: Severity;
  // What we found, in plain language a business owner understands.
  detail: string;
  // Why it costs them customers/money — only for failures/warnings.
  impact?: string;
  fix?: string;
};

export type CategoryId = "security" | "performance" | "seo" | "mobile" | "accessibility" | "conversion" | "technology";

export type AuditCategory = {
  id: CategoryId;
  name: string;
  score: number; // 0-100
  checks: AuditCheck[];
};

export type AiSummary = {
  headline: string;
  executiveSummary: string;
  topProblems: { title: string; explanation: string; businessImpact: string }[];
  designObservations: string[];
  quickWins: string[];
  pitch: string;
};

export type VideoScene = {
  kind: "intro" | "walkthrough" | "issue" | "outro";
  title: string;
  narration: string;
  // Where on the full-page screenshot this scene looks, 0 = top, 1 = bottom.
  focus: number;
  bullets?: string[];
};

export type AuditReport = {
  url: string;
  finalUrl: string;
  domain: string;
  fetchedAt: string;
  responseTimeMs: number;
  pageTitle: string | null;
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: AuditCategory[];
  screenshot: string | null; // data: URL of the full-page screenshot
  screenshotSource: "thum.io" | null;
  ai: AiSummary | null;
  aiError: string | null;
  videoScript: VideoScene[];
  warnings: string[];
};
