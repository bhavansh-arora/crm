import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { AiSummary, AuditCategory, VideoScene } from "./types";

// Claude reviews the automated findings *and* looks at the full-page
// screenshot, then writes (1) a plain-English report for the business owner
// and (2) a narrated, scene-by-scene script for the walkthrough video.

const SceneSchema = z.object({
  kind: z.enum(["intro", "walkthrough", "issue", "outro"]),
  title: z.string().describe("Short on-screen caption, max ~6 words"),
  narration: z.string().describe("What the narrator says during this scene: 1-3 spoken sentences, ~20-45 words"),
  focus: z.number().describe("Vertical position on the full-page screenshot this scene shows: 0 = very top, 1 = very bottom"),
  bullets: z.array(z.string()).describe("0-3 very short on-screen bullet points (max ~7 words each)"),
});

const OutputSchema = z.object({
  headline: z.string().describe("One punchy sentence verdict on the website"),
  executiveSummary: z.string().describe("3-5 sentence summary for the business owner"),
  topProblems: z
    .array(z.object({ title: z.string(), explanation: z.string(), businessImpact: z.string() }))
    .describe("The 5 most damaging problems, most serious first"),
  designObservations: z.array(z.string()).describe("3-6 observations about visual design, layout, branding and first impression, based on the screenshot"),
  quickWins: z.array(z.string()).describe("3-5 fixes that would make the biggest difference fastest"),
  pitch: z.string().describe("A friendly 2-3 sentence closing pitch offering to fix these issues, written from the agency to the business owner"),
  scenes: z.array(SceneSchema).describe("7-10 scenes for a 60-90 second walkthrough video, in order: 1 intro, several walkthrough/issue scenes moving top to bottom through the page, 1 outro"),
});

const SYSTEM = `You are a senior web consultant at a digital agency. Sales reps use you to audit prospects' websites and show the owners, honestly and specifically, why their current website is costing them customers.

Write for a non-technical small-business owner: concrete, plain English, no jargon without a one-line explanation, and always tie a problem to lost calls, leads, trust or Google visibility. Be candid but never insulting. Only state facts supported by the automated findings or clearly visible in the screenshot — do not invent numbers or problems. If the site is actually good, say so and focus on what could still improve.

For the video script: narrate a guided tour that scrolls down the actual page from top to bottom, pointing at real sections you can see in the screenshot (header, hero, services, footer, etc.) and calling out the problems as you reach them. The "focus" value must correspond to where that section really sits in the screenshot. The audience is Indian small-business owners and the narration is read by an Indian English voice: write in natural Indian English, use ₹ for any money, avoid American idioms and slang, and keep the tone warm, respectful and professional — like a trusted consultant, never salesy. Spoken narration should read smoothly aloud: short sentences, no bullet symbols, no URLs beyond the bare domain, no abbreviations the listener wouldn't say out loud.`;

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
  textExcerpt: string;
}): Promise<{ summary: AiSummary; scenes: VideoScene[] }> {
  const client = new Anthropic();
  const image = screenshotBlock(input.screenshot);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) {
    content.push({ type: "text", text: "Full-page screenshot of the website's homepage (top of the image = top of the page):" });
    content.push(image);
  }
  content.push({
    type: "text",
    text: `Website: ${input.url}
Page title: ${input.pageTitle ?? "(none)"}
Overall automated score: ${input.overallScore}/100
${image ? "" : "\n(No screenshot available — base design comments only on the findings and text, and space scene focus values evenly.)\n"}
# Automated findings
${formatFindings(input.categories)}

# Visible text on the page (excerpt)
${input.textExcerpt}

Write the report and the walkthrough video script.`,
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
    scenes: scenes.map((s) => ({ ...s, focus: Math.min(1, Math.max(0, s.focus)) })),
  };
}
