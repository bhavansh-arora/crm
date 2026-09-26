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

// What the page actually says and offers — extracted from the HTML.
export type SiteContent = {
  heroHeadline: string | null;
  heroSubheadline: string | null;
  headings: { level: number; text: string }[];
  ctas: string[];
  testimonials: string[];
  trustSignals: string[];
  pages: Record<"about" | "services" | "pricing" | "faq" | "blog" | "caseStudies" | "contact" | "booking" | "gallery", boolean>;
  hasOffer: boolean;
  hasLeadMagnet: boolean;
  siteType: "store" | "business";
  // Heading of a testimonials / results section (video or screenshot
  // testimonials often have no quotable text).
  proofSection: string | null;
  hasFaq: boolean;
  hasDemoVideo: boolean;
  hasGuarantee: boolean;
  hasUrgency: boolean;
  hasPaymentBadges: boolean;
  price: string | null;
  metaDescription: string | null;
};

export type FunnelStageId = "tof" | "mof" | "bof";

export type FunnelItem = { label: string; status: "yes" | "partial" | "no"; note: string };

export type FunnelStage = {
  id: FunnelStageId;
  name: string; // "Top of funnel"
  goal: string; // "Get found & grab attention"
  score: number;
  items: FunnelItem[];
};

export type AiSummary = {
  headline: string;
  executiveSummary: string;
  topProblems: { title: string; explanation: string; businessImpact: string }[];
  designObservations: string[];
  quickWins: string[];
  pitch: string;
  mobileFirstImpression: { whatVisitorsSee: string; verdict: string; missingAboveFold: string[] };
  headlineReview: { current: string; verdict: string; problems: string[]; rewrites: string[] };
  funnel: { tof: string; mof: string; bof: string; biggestLeak: FunnelStageId };
  socialProof: { verdict: string; recommendations: string[] };
};

export type VideoSceneKind = "intro" | "mobile" | "headline" | "funnel" | "proof" | "walkthrough" | "issue" | "outro" | "cta";

// How a walkthrough/issue scene illustrates its point:
// page    — spotlight a real, visible part of the page (at focus, `span` tall)
// missing — mark where something that doesn't exist yet should go
// google  — show how the site appears in a Google search result
// none    — a behind-the-scenes issue with nothing to point at on the page
export type SceneVisual = "page" | "missing" | "google" | "none";

export type VideoScene = {
  kind: VideoSceneKind;
  title: string;
  narration: string;
  // Where on the full-page screenshot this scene looks, 0 = top, 1 = bottom.
  focus: number;
  bullets?: string[];
  // "headline" scenes: the current headline and a stronger rewrite.
  currentHeadline?: string;
  rewrite?: string;
  // "proof" scenes: a real testimonial from the page, if any.
  quote?: string;
  visual?: SceneVisual;
  // Height of the highlighted section as a fraction of the full page.
  span?: number;
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
  screenshot: string | null; // data: URL of the full-page desktop screenshot
  mobileScreenshot: string | null; // data: URL of the phone's first screen (above the fold)
  screenshotSource: "thum.io" | null;
  content: SiteContent;
  funnel: FunnelStage[];
  ai: AiSummary | null;
  aiError: string | null;
  videoScript: VideoScene[];
  warnings: string[];
};
