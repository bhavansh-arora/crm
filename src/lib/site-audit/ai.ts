import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { AiSummary, AuditCategory, FunnelStage, SiteContent, VideoScene } from "./types";

// Claude reviews the automated findings, the extracted page content and
// funnel, and looks at both the full-page desktop screenshot and the
// phone's first screen. It writes (1) a plain-English report for the
// business owner and (2) a narrated, chaptered script for the video.

const SceneSchema = z.object({
  kind: z.enum(["intro", "mobile", "headline", "funnel", "proof", "walkthrough", "issue", "outro"]),
  title: z.string().describe("Short on-screen caption, max ~6 words"),
  narration: z.string().describe("What the narrator says during this scene, written to be spoken: 2-4 conversational sentences, ~25-50 words"),
  focus: z.number().describe("Where the section this scene discusses STARTS on the full-page desktop screenshot, as a fraction of the page height: 0 = very top, 1 = very bottom"),
  span: z.number().describe("Height of that section as a fraction of the page height (e.g. 0.04 for a single heading, 0.12 for a large section). Keep it tight: just the part being discussed."),
  visual: z
    .enum(["page", "missing", "google", "none"])
    .describe(
      'How walkthrough/issue scenes illustrate the point: "page" = spotlight a specific, VISIBLE part of the page (use focus+span); "missing" = something that should exist but doesn\'t (focus = where it should go); "google" = search title/description/schema problems, shown as a Google result; "none" = behind-the-scenes issues with nothing visible (speed, security headers, code). Never spotlight a page section for something that isn\'t visible there.'
    ),
  bullets: z.array(z.string()).describe("0-3 very short on-screen bullet points (max ~7 words each)"),
  currentHeadline: z.string().describe('For "headline" scenes: the site\'s current main headline, verbatim. Otherwise empty.'),
  rewrite: z.string().describe('For "headline" scenes: your single strongest rewrite (max ~10 words). Otherwise empty.'),
  quote: z.string().describe('For "proof" scenes: one real testimonial copied from the page (max ~30 words), or empty if there are none. Never invent one.'),
});

const OutputSchema = z.object({
  headline: z.string().describe("One punchy sentence verdict on the website"),
  executiveSummary: z.string().describe("3-5 sentence summary for the business owner"),
  topProblems: z
    .array(z.object({ title: z.string(), explanation: z.string(), businessImpact: z.string() }))
    .describe("The 5 most damaging problems, most serious first"),
  designObservations: z.array(z.string()).describe("3-6 observations about visual design, layout, branding and first impression, based on the screenshots"),
  quickWins: z.array(z.string()).describe("3-5 fixes that would make the biggest difference fastest"),
  pitch: z.string().describe("A confident 2-3 sentence closing pitch offering to fix these issues, written from the agency to the business owner"),
  mobileFirstImpression: z.object({
    whatVisitorsSee: z.string().describe("2-3 sentences describing exactly what is on the phone's first screen, based on the mobile screenshot"),
    verdict: z.string().describe("One sentence judgement: does the first screen tell a visitor what this is and how to act?"),
    missingAboveFold: z.array(z.string()).describe("0-5 things that should be visible on the first mobile screen but aren't (e.g. clear headline, call button, WhatsApp, trust signal)"),
  }),
  headlineReview: z.object({
    current: z.string().describe("The current main headline, verbatim (or 'No clear headline')"),
    verdict: z.string().describe("1-2 sentences: does it say who it's for and what result they get?"),
    problems: z.array(z.string()).describe("1-4 specific problems with the headline and sub-headline"),
    rewrites: z.array(z.string()).describe("3 stronger headline options, each under 12 words, specific to this business"),
  }),
  funnel: z.object({
    tof: z.string().describe("2-3 sentences on the top of funnel: how well the site gets found and grabs attention"),
    mof: z.string().describe("2-3 sentences on the middle of funnel: how well it builds interest and trust (services, testimonials, proof, FAQ, pricing)"),
    bof: z.string().describe("2-3 sentences on the bottom of funnel: how well it converts interest into calls, WhatsApp messages, forms or bookings"),
    biggestLeak: z.enum(["tof", "mof", "bof"]).describe("The stage losing the most customers"),
  }),
  socialProof: z.object({
    verdict: z.string().describe("1-2 sentences on the testimonials, reviews and trust signals found"),
    recommendations: z.array(z.string()).describe("2-4 specific ways to add or strengthen social proof"),
  }),
  scenes: z
    .array(SceneSchema)
    .describe(
      "9-12 scenes for a 90-150 second video, in this order: intro; mobile (the phone's first screen); headline; funnel (TOF, MOF, BOF and the biggest leak); proof (testimonials & trust); 3-5 walkthrough/issue scenes moving down the page; outro"
    ),
});

const SYSTEM = `You are a senior conversion consultant at a digital agency. Sales reps use you to audit prospects' websites and show the owners, honestly and specifically, why their current website is costing them customers.

Write for a non-technical small-business owner: concrete, plain English, no jargon without a one-line explanation, and always tie a problem to lost calls, leads, trust or Google visibility. Frame the site as a marketing funnel: top of funnel (TOF: getting found and grabbing attention), middle of funnel (MOF: building interest and trust through services, testimonials, proof, FAQs and pricing), bottom of funnel (BOF: turning interest into a call, WhatsApp message, form or booking). Be candid but never insulting. Only state facts supported by the automated findings, the extracted content, or what is clearly visible in the screenshots — never invent numbers, testimonials or problems. If something is genuinely good, say so.

For the video script: it is a guided, chaptered review. Open with the verdict, show the phone's first screen, critique the headline and offer a sharper rewrite, walk through the funnel stage by stage, assess testimonials and trust, then scroll down the real page pointing at actual sections and calling out problems, and close with the path forward. The "focus" value must correspond to where that section really sits in the desktop screenshot.

Voice and tone: the narration is read aloud by an Indian English voice and must sound like a real person — a sharp, friendly expert sitting across the table from the owner, not a robot reading a report. Be conversational and energetic: use contractions (you're, it's, don't, here's), talk to the owner directly as "you", mix short punchy lines with longer ones, and use the occasional rhetorical question or natural spoken turn ("Here's the thing.", "Now look at this.", "So what happens?"). Stay confident — state findings plainly, never hedge ("it seems", "maybe", "might want to") — but keep it warm, never preachy or salesy. Write natural Indian English, use ₹ for any money, avoid American slang. Narration must read smoothly aloud: no bullet symbols, no URLs beyond the bare domain, no abbreviations a listener wouldn't say out loud (say "top of the funnel", not "TOF").`;

function formatFindings(categories: AuditCategory[]): string {
  const lines: string[] = [];
  for (const cat of categories) {
    lines.push(`\n## ${cat.name} — ${cat.score}/100`);
    for (const c of cat.checks) {
      lines.push(`- [${c.status.toUpperCase()}${c.status === "pass" || c.status === "info" ? "" : ", " + c.severity}] ${c.title}: ${c.detail}`);
    }
  }
  return lines.join("\n");
}

function formatContent(content: SiteContent, funnel: FunnelStage[]): string {
  const pages = Object.entries(content.pages)
    .map(([k, v]) => `${k}: ${v ? "yes" : "no"}`)
    .join(", ");
  return `Site type: ${content.siteType === "store" ? "online store / product sales page — judge it on how well it sells (buy button, price, proof, guarantee, urgency), not on phone calls or enquiry forms" : "service business — judge it on how well it generates calls, WhatsApp messages and enquiries"}
Price shown: ${content.price ?? "no"} · Demo video: ${content.hasDemoVideo ? "yes" : "no"} · FAQ: ${content.hasFaq ? "yes" : "no"} · Guarantee: ${content.hasGuarantee ? "yes" : "no"} · Urgency: ${content.hasUrgency ? "yes" : "no"} · Payment badges: ${content.hasPaymentBadges ? "yes" : "no"}
Results/testimonials section heading: ${content.proofSection ?? "(none)"}
Main headline: ${content.heroHeadline ?? "(none found)"}
Sub-headline: ${content.heroSubheadline ?? "(none found)"}
Headings (in order): ${content.headings.map((h) => `H${h.level} "${h.text}"`).join(" · ") || "(none)"}
Calls-to-action found: ${content.ctas.map((c) => `"${c}"`).join(", ") || "(none)"}
Testimonials found on the page: ${content.testimonials.length ? content.testimonials.map((t) => `\n  - "${t}"`).join("") : "(none)"}
Trust signals found: ${content.trustSignals.join(", ") || "(none)"}
Key pages/sections linked: ${pages}
Offer / reason to act now: ${content.hasOffer ? "yes" : "no"} · Lead magnet / newsletter: ${content.hasLeadMagnet ? "yes" : "no"}

# Funnel scoring (automated)
${funnel
  .map((f) => `## ${f.name} (${f.goal}) — ${f.score}/100\n${f.items.map((i) => `- [${i.status}] ${i.label}: ${i.note}`).join("\n")}`)
  .join("\n")}`;
}

function screenshotBlock(dataUrl: string | null): Anthropic.Beta.BetaImageBlockParam | null {
  const m = dataUrl?.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!m) return null;
  // API limit is 5 MB per image; skip rather than fail the whole report.
  if ((m[2].length * 3) / 4 > 4.8 * 1024 * 1024) return null;
  return { type: "image", source: { type: "base64", media_type: m[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: m[2] } };
}

export async function generateAiReport(input: {
  url: string;
  pageTitle: string | null;
  overallScore: number;
  categories: AuditCategory[];
  screenshot: string | null;
  mobileScreenshot: string | null;
  content: SiteContent;
  funnel: FunnelStage[];
  textExcerpt: string;
}): Promise<{ summary: AiSummary; scenes: VideoScene[] }> {
  const client = new Anthropic();
  const desktop = screenshotBlock(input.screenshot);
  const mobile = screenshotBlock(input.mobileScreenshot);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (desktop) {
    content.push({ type: "text", text: "Full-page desktop screenshot of the homepage (top of the image = top of the page):" });
    content.push(desktop);
  }
  if (mobile) {
    content.push({ type: "text", text: "The first screen a visitor sees on an iPhone, before scrolling (above the fold):" });
    content.push(mobile);
  }
  content.push({
    type: "text",
    text: `Website: ${input.url}
Page title: ${input.pageTitle ?? "(none)"}
Overall automated score: ${input.overallScore}/100
${desktop ? "" : "\n(No desktop screenshot — base design comments on the findings and text, and space scene focus values evenly.)\n"}${mobile ? "" : "\n(No mobile screenshot — judge the first mobile screen from the headline, CTAs and mobile findings, and say so.)\n"}
# Page content
${formatContent(input.content, input.funnel)}

# Automated findings
${formatFindings(input.categories)}

# Visible text on the page (excerpt)
${input.textExcerpt}

Write the report and the chaptered video script.`,
  });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: betaZodOutputFormat(OutputSchema) },
  });

  if (response.stop_reason === "refusal") throw new Error("The AI declined to review this website.");
  const out = response.parsed_output;
  if (!out) throw new Error(`The AI response couldn't be read (stop reason: ${response.stop_reason}).`);

  const { scenes, ...summary } = out;
  return {
    summary,
    scenes: scenes.map((s) => ({
      ...s,
      focus: Math.min(1, Math.max(0, s.focus)),
      span: Math.min(0.5, Math.max(0.005, s.span)),
      currentHeadline: s.currentHeadline || undefined,
      rewrite: s.rewrite || undefined,
      quote: s.quote || undefined,
    })),
  };
}
