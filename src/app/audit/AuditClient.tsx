"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/fetcher";
import type { AuditCategory, AuditCheck, AuditReport } from "@/lib/site-audit/types";
import VideoStudio from "./VideoStudio";

const STEPS = [
  "Loading the website…",
  "Checking security & HTTPS…",
  "Testing speed with Google Lighthouse…",
  "Checking Google/SEO setup…",
  "Checking the mobile experience…",
  "Capturing a full-page screenshot…",
  "Looking for contact options & calls-to-action…",
  "AI is reviewing the design and writing the report…",
];

function scoreColor(score: number) {
  return score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-rose-600";
}
function scoreBg(score: number) {
  return score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-rose-500";
}

const STATUS_STYLE: Record<AuditCheck["status"], { icon: string; cls: string }> = {
  pass: { icon: "✓", cls: "bg-emerald-100 text-emerald-700" },
  warn: { icon: "!", cls: "bg-amber-100 text-amber-700" },
  fail: { icon: "✕", cls: "bg-rose-100 text-rose-700" },
  info: { icon: "i", cls: "bg-slate-100 text-slate-600" },
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const stroke = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#e11d48";
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={stroke} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs font-medium text-slate-500">Grade {grade}</span>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: AuditCategory }) {
  const problems = category.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const [open, setOpen] = useState(problems.length > 0);
  const sorted = [...category.checks].sort((a, b) => ["fail", "warn", "info", "pass"].indexOf(a.status) - ["fail", "warn", "info", "pass"].indexOf(b.status));
  return (
    <div className="break-inside-avoid rounded-xl bg-white ring-1 ring-slate-200">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`w-10 text-lg font-bold ${scoreColor(category.score)}`}>{category.score}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900">{category.name}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${scoreBg(category.score)}`} style={{ width: `${category.score}%` }} />
          </div>
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {problems.length ? `${problems.length} issue${problems.length > 1 ? "s" : ""}` : "All good"}
        </span>
        <span className="no-print text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {sorted.map((c) => (
            <li key={c.id} className="flex gap-3 px-4 py-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STATUS_STYLE[c.status].cls}`}>
                {STATUS_STYLE[c.status].icon}
              </span>
              <div className="min-w-0 text-sm">
                <div className="font-medium text-slate-800">
                  {c.title}
                  {(c.status === "fail" || c.status === "warn") && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{c.severity}</span>
                  )}
                </div>
                <div className="break-words text-slate-600">{c.detail}</div>
                {c.impact && <div className="mt-1 text-rose-700">Why it matters: {c.impact}</div>}
                {c.fix && <div className="mt-0.5 text-emerald-700">Fix: {c.fix}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function whatsappSummary(report: AuditReport): string {
  const issues = report.categories
    .flatMap((c) => c.checks)
    .filter((c) => c.status === "fail")
    .slice(0, 6)
    .map((c) => `❌ ${c.title}`);
  return [
    `Hi! I reviewed ${report.domain} — it scored ${report.overallScore}/100 (grade ${report.grade}).`,
    report.ai?.headline ?? "",
    "",
    "Biggest problems I found:",
    ...issues,
    "",
    report.ai?.pitch ?? "These are all fixable — happy to walk you through the full report and a plan to fix them.",
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n");
}

export default function AuditClient({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [copied, setCopied] = useState(false);
  const autoRan = useRef(false);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 7000);
    return () => clearInterval(t);
  }, [loading]);

  async function run(target: string) {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await apiRequest<{ report: AuditReport }>("/api/site-audit", "POST", { url: target.trim() });
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialUrl && !autoRan.current) {
      autoRan.current = true;
      run(initialUrl);
    }
  }, [initialUrl]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    run(url);
  }

  async function copySummary() {
    if (!report) return;
    await navigator.clipboard.writeText(whatsappSummary(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const failCount = report?.categories.flatMap((c) => c.checks).filter((c) => c.status === "fail").length ?? 0;
  const warnCount = report?.categories.flatMap((c) => c.checks).filter((c) => c.status === "warn").length ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Website Audit</h1>
        <p className="mb-5 text-sm text-slate-500">
          Enter a prospect&apos;s website to get a full report on what&apos;s wrong with it (speed, security, Google visibility,
          mobile, lead capture), plus an AI-narrated walkthrough video you can send them.
        </p>

        <form onSubmit={handleSubmit} className="mb-5 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. www.example-business.com"
            inputMode="url"
            autoCapitalize="none"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Auditing…" : "Audit site"}
          </button>
        </form>

        {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-200">{error}</div>}

        {loading && (
          <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <span className="font-medium text-slate-800">{STEPS[step]}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-500 transition-all duration-1000" style={{ width: `${((step + 1) / STEPS.length) * 95}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500">A full audit usually takes 30–90 seconds.</p>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-5">
          {/* Header */}
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ScoreRing score={report.overallScore} grade={report.grade} />
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">Website audit report</div>
                <a href={report.finalUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xl font-semibold text-brand-700 hover:underline">
                  {report.domain}
                </a>
                {report.ai && <p className="mt-1 font-medium text-slate-800">{report.ai.headline}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">{failCount} critical problems</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">{warnCount} warnings</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Audited {new Date(report.fetchedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="no-print mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => window.print()} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                📄 Save as PDF
              </button>
              <button onClick={copySummary} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                {copied ? "✓ Copied" : "💬 Copy WhatsApp summary"}
              </button>
              <a href="#video" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                🎬 Walkthrough video
              </a>
            </div>
          </div>

          {(report.warnings.length > 0 || report.aiError) && (
            <div className="no-print rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              {[...report.warnings, report.aiError].filter(Boolean).map((w) => (
                <div key={w}>⚠ {w}</div>
              ))}
            </div>
          )}

          {/* AI summary */}
          {report.ai && (
            <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-2 text-lg font-semibold">Summary</h2>
              <p className="text-sm leading-relaxed text-slate-700">{report.ai.executiveSummary}</p>

              <h3 className="mb-2 mt-5 font-semibold">Why this website is losing customers</h3>
              <ol className="space-y-3">
                {report.ai.topProblems.map((p, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">{i + 1}</span>
                    <div>
                      <div className="font-medium text-slate-900">{p.title}</div>
                      <div className="text-slate-600">{p.explanation}</div>
                      <div className="mt-0.5 text-rose-700">Business impact: {p.businessImpact}</div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-semibold">Design &amp; first impression</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {report.ai.designObservations.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Quick wins</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-800">
                    {report.ai.quickWins.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              </div>
              <p className="mt-5 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{report.ai.pitch}</p>
            </div>
          )}

          {/* Lighthouse */}
          {report.pageSpeed && (
            <div className="break-inside-avoid rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-3 text-lg font-semibold">Google Lighthouse (mobile)</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ["Performance", report.pageSpeed.performance],
                  ["Accessibility", report.pageSpeed.accessibility],
                  ["Best practices", report.pageSpeed.bestPractices],
                  ["SEO", report.pageSpeed.seo],
                ] as const).map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                    <div className={`text-2xl font-bold ${v == null ? "text-slate-400" : scoreColor(v)}`}>{v ?? "–"}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              {report.pageSpeed.metrics.length > 0 && (
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {report.pageSpeed.metrics.map((m) => (
                    <li key={m.label} className="flex justify-between gap-2 rounded px-2 py-1 odd:bg-slate-50">
                      <span className="text-slate-600">{m.label}</span>
                      <span className={m.rating === "good" ? "text-emerald-600" : m.rating === "average" ? "text-amber-600" : "font-medium text-rose-600"}>{m.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Categories */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Detailed findings</h2>
            <div className="space-y-3">
              {[...report.categories].sort((a, b) => a.score - b.score).map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
            </div>
          </div>

          {/* Video */}
          <div id="video" className="no-print scroll-mt-20">
            <VideoStudio report={report} />
          </div>
        </div>
      )}
    </div>
  );
}
