"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { apiRequest } from "@/lib/fetcher";
import type { AuditCategory, AuditCheck, AuditReport, CategoryId } from "@/lib/site-audit/types";
import { fontVars } from "./fonts";
import VideoStudio from "./VideoStudio";

const STEPS = [
  "Opening the website",
  "Inspecting security & HTTPS",
  "Measuring loading speed",
  "Reviewing Google / SEO setup",
  "Testing the mobile experience",
  "Capturing the full page",
  "Checking how visitors can get in touch",
  "Writing the expert review",
];

const ICONS: Record<CategoryId, ReactNode> = {
  security: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z M9 12l2 2 4-4" />,
  performance: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  seo: <path d="M11 4a7 7 0 100 14 7 7 0 000-14z M20 20l-4-4" />,
  mobile: <path d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z M11 18h2" />,
  accessibility: <path d="M12 5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M5 8l7 1 7-1 M12 9v5l-3 7 M12 14l3 7" />,
  conversion: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" />,
  technology: <path d="M8 8l-4 4 4 4 M16 8l4 4-4 4 M13 5l-2 14" />,
};

function Icon({ id, className = "h-5 w-5" }: { id: CategoryId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {ICONS[id]}
    </svg>
  );
}

const CATEGORY_BLURB: Record<CategoryId, string> = {
  security: "HTTPS, padlock, protection headers",
  performance: "Load time, page weight, compression",
  seo: "Titles, descriptions, sitemap, schema",
  mobile: "Responsive layout, tap-to-call",
  accessibility: "Alt text, labels, readable links",
  conversion: "Calls-to-action, forms, WhatsApp, trust",
  technology: "Outdated code, broken links, CMS",
};

function tone(score: number) {
  return score >= 75
    ? { text: "text-emerald-700", bar: "bg-emerald-500", stroke: "#3fb68b", label: "Healthy" }
    : score >= 50
      ? { text: "text-amber-700", bar: "bg-amber-500", stroke: "#e0a93b", label: "Needs work" }
      : { text: "text-rose-700", bar: "bg-rose-500", stroke: "#e5484d", label: "Critical" };
}

const STATUS_STYLE: Record<AuditCheck["status"], { dot: string; label: string }> = {
  fail: { dot: "bg-rose-500", label: "Failing" },
  warn: { dot: "bg-amber-400", label: "Needs work" },
  pass: { dot: "bg-emerald-500", label: "Passing" },
  info: { dot: "bg-slate-300", label: "Info" },
};

function ScoreRing({ score, grade, size = 176 }: { score: number; grade: string; size?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 180 180" className="h-full w-full">
        <circle cx="90" cy="90" r="86" fill="none" stroke="rgba(200,161,90,0.35)" strokeWidth="1" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(250,248,243,0.08)" strokeWidth="8" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={tone(score).stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform="rotate(-90 90 90)"
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-semibold text-ivory">{score}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-400">Grade {grade}</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-ivory/40">out of 100</span>
      </div>
    </div>
  );
}

function SectionHeading({ n, title, kicker }: { n: string; title: string; kicker?: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-4 border-b border-slate-200 pb-3">
      <span className="font-display text-lg text-gold-600">{n}</span>
      <h2 className="font-display text-2xl font-semibold text-ink-900">{title}</h2>
      {kicker && <span className="ml-auto hidden text-xs uppercase tracking-[0.16em] text-slate-400 sm:block">{kicker}</span>}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`break-inside-avoid rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8 ${className}`}>{children}</div>;
}

function CategoryCard({ category }: { category: AuditCategory }) {
  const problems = category.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const [open, setOpen] = useState(problems.length > 0);
  const order = ["fail", "warn", "info", "pass"];
  const sorted = [...category.checks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const t = tone(category.score);
  return (
    <div id={`cat-${category.id}`} className="scroll-mt-24 break-inside-avoid overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/70 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-gold-400">
          <Icon id={category.id} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold text-ink-900">{category.name}</div>
          <div className="text-xs text-slate-500">
            {problems.length ? `${problems.length} issue${problems.length > 1 ? "s" : ""} found` : "No issues found"} · {category.checks.length} checks
          </div>
        </div>
        <div className="text-right">
          <div className={`font-display text-2xl font-semibold ${t.text}`}>{category.score}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{t.label}</div>
        </div>
        <svg viewBox="0 0 20 20" className={`no-print h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} fill="currentColor">
          <path d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" />
        </svg>
      </button>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {sorted.map((c) => (
            <li key={c.id} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6 sm:px-6">
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[c.status].dot}`} />
                <div>
                  <div className="text-sm font-semibold text-ink-900">{c.title}</div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    {STATUS_STYLE[c.status].label}
                    {(c.status === "fail" || c.status === "warn") && ` · ${c.severity}`}
                  </div>
                </div>
              </div>
              <div className="text-sm leading-relaxed">
                <p className="break-words text-slate-700">{c.detail}</p>
                {c.impact && (
                  <p className="mt-1.5 text-slate-600">
                    <span className="font-semibold text-rose-700">Why it matters · </span>
                    {c.impact}
                  </p>
                )}
                {c.fix && (
                  <p className="mt-1 text-slate-600">
                    <span className="font-semibold text-emerald-700">Recommended fix · </span>
                    {c.fix}
                  </p>
                )}
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
    .map((c) => `• ${c.title} — ${c.detail}`);
  return [
    `Namaste! I reviewed *${report.domain}* — it scored *${report.overallScore}/100* (grade ${report.grade}).`,
    report.ai?.headline ?? "",
    "",
    "*The biggest problems I found:*",
    ...issues,
    "",
    report.ai?.pitch ?? "All of these are fixable — happy to walk you through the full report and a plan to fix them.",
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n");
}

function UrlForm({ url, setUrl, loading, onSubmit, dark }: { url: string; setUrl: (v: string) => void; loading: boolean; onSubmit: (e: FormEvent) => void; dark: boolean }) {
  return (
    <form
      onSubmit={onSubmit}
      className={`flex items-center gap-2 rounded-full p-1.5 pl-5 ${dark ? "bg-white/[0.06] ring-1 ring-white/15 focus-within:ring-gold-500/60" : "bg-white shadow-sm ring-1 ring-slate-200 focus-within:ring-gold-500/60"}`}
    >
      <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${dark ? "text-ivory/40" : "text-slate-400"}`} fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
      </svg>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="yourprospect.com"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`min-w-0 flex-1 bg-transparent py-2 text-base ${dark ? "text-ivory placeholder:text-ivory/35" : "text-ink-900 placeholder:text-slate-400"}`}
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="shrink-0 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:opacity-50 sm:px-7"
      >
        {loading ? "Auditing…" : "Run audit"}
      </button>
    </form>
  );
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

  const allChecks = report?.categories.flatMap((c) => c.checks) ?? [];
  const failCount = allChecks.filter((c) => c.status === "fail").length;
  const warnCount = allChecks.filter((c) => c.status === "warn").length;
  const passCount = allChecks.filter((c) => c.status === "pass").length;
  let section = 0;
  const nextSection = () => String(++section).padStart(2, "0");

  return (
    <div style={fontVars} className="mx-auto max-w-5xl font-body text-slate-800 lining-nums">
      {/* Hero / search */}
      {!report && (
        <div className="no-print relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-ivory shadow-xl sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gold-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-400">Website Intelligence</div>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">
              See exactly why a website is <em className="font-medium text-gold-300">losing customers.</em>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ivory/65">
              A complete expert audit of any business website, with a narrated walkthrough film you can send straight to the owner.
            </p>
            <div className="mt-8 max-w-2xl">
              <UrlForm url={url} setUrl={setUrl} loading={loading} onSubmit={handleSubmit} dark />
            </div>
            {error && <div className="mt-4 max-w-2xl rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-400/30">{error}</div>}

            {loading ? (
              <ol className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
                {STEPS.map((s, i) => (
                  <li key={s} className={`flex items-center gap-3 text-sm transition ${i > step ? "text-ivory/30" : i === step ? "text-ivory" : "text-ivory/60"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ring-1 ${i < step ? "bg-gold-500 text-ink-950 ring-gold-500" : i === step ? "ring-gold-400" : "ring-white/15"}`}>
                      {i < step ? "✓" : i === step ? <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" /> : i + 1}
                    </span>
                    {s}
                  </li>
                ))}
                <li className="text-xs text-ivory/40 sm:col-span-2">A thorough audit takes 30–90 seconds.</li>
              </ol>
            ) : (
              <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
                {(Object.keys(CATEGORY_BLURB) as CategoryId[]).slice(0, 7).map((id) => (
                  <div key={id} className="bg-ink-900 p-5">
                    <Icon id={id} className="h-5 w-5 text-gold-400" />
                    <div className="mt-3 text-sm font-semibold text-ivory">
                      {{ security: "Security", performance: "Speed", seo: "Google visibility", mobile: "Mobile", accessibility: "Accessibility", conversion: "Lead capture", technology: "Code quality" }[id]}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-ivory/45">{CATEGORY_BLURB[id]}</div>
                  </div>
                ))}
                <div className="flex flex-col justify-center bg-ink-900 p-5">
                  <div className="font-display text-lg italic text-gold-300">+ AI design review</div>
                  <div className="mt-1 text-xs leading-relaxed text-ivory/45">and a narrated video in an Indian English voice</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-8">
          <div className="no-print">
            <UrlForm url={url} setUrl={setUrl} loading={loading} onSubmit={handleSubmit} dark={false} />
          </div>

          {/* Cover */}
          <div className="print-dark relative overflow-hidden rounded-3xl bg-ink-900 text-ivory shadow-xl">
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gold-500/15 blur-3xl" />
            <div className="relative flex flex-col gap-8 p-8 sm:p-12 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-400">Website Audit Report</div>
                <a href={report.finalUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all font-display text-4xl font-semibold leading-tight hover:text-gold-200 sm:text-5xl">
                  {report.domain}
                </a>
                <div className="mt-4 h-px w-16 bg-gold-500" />
                {report.ai && <p className="mt-4 max-w-xl font-display text-xl italic leading-snug text-ivory/80">&ldquo;{report.ai.headline}&rdquo;</p>}
                <div className="mt-6 text-xs uppercase tracking-[0.16em] text-ivory/40">
                  Audited {new Date(report.fetchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <ScoreRing score={report.overallScore} grade={report.grade} />
            </div>
            <div className="relative grid grid-cols-3 border-t border-white/10">
              {[
                [failCount, "Critical issues", "text-rose-300"],
                [warnCount, "Warnings", "text-amber-200"],
                [passCount, "Checks passed", "text-emerald-300"],
              ].map(([n, label, cls], i) => (
                <div key={label as string} className={`px-4 py-5 text-center sm:px-8 ${i ? "border-l border-white/10" : ""}`}>
                  <div className={`font-display text-3xl font-semibold ${cls}`}>{n}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ivory/45 sm:text-[11px]">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="no-print flex flex-wrap gap-2">
            <a href="#video" className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-ivory shadow-sm transition hover:bg-ink-800">
              ▶ Walkthrough video
            </a>
            <button onClick={() => window.print()} className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              Save as PDF
            </button>
            <button onClick={copySummary} className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-ink-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              {copied ? "✓ Copied" : "Copy WhatsApp summary"}
            </button>
          </div>

          {(report.warnings.length > 0 || report.aiError) && (
            <div className="no-print rounded-xl bg-gold-50 px-4 py-3 text-xs leading-relaxed text-gold-700 ring-1 ring-gold-100">
              {[...report.warnings, report.aiError].filter(Boolean).map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}

          {/* Scorecard */}
          <Card>
            <SectionHeading n={nextSection()} title="Scorecard" kicker="Seven areas · weighted" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col justify-between rounded-xl bg-ink-900 p-4 text-ivory">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-400">Overall</span>
                  <span className={`font-display text-2xl font-semibold ${report.overallScore >= 75 ? "text-emerald-300" : report.overallScore >= 50 ? "text-amber-200" : "text-rose-300"}`}>{report.overallScore}</span>
                </div>
                <div className="mt-3 text-sm font-semibold">Grade {report.grade}</div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gold-500" style={{ width: `${report.overallScore}%` }} />
                </div>
              </div>
              {report.categories.map((c) => {
                const t = tone(c.score);
                return (
                  <a key={c.id} href={`#cat-${c.id}`} className="group rounded-xl p-4 ring-1 ring-slate-200/80 transition hover:ring-gold-500/60">
                    <div className="flex items-center justify-between">
                      <Icon id={c.id} className="h-5 w-5 text-slate-400 group-hover:text-gold-600" />
                      <span className={`font-display text-2xl font-semibold ${t.text}`}>{c.score}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-ink-900">{c.name}</div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${t.bar}`} style={{ width: `${c.score}%` }} />
                    </div>
                  </a>
                );
              })}
            </div>
          </Card>

          {report.ai && (
            <>
              <Card>
                <SectionHeading n={nextSection()} title="Executive summary" />
                <p className="max-w-3xl font-display text-xl leading-relaxed text-slate-700">
                  {report.ai.executiveSummary}
                </p>
              </Card>

              <Card>
                <SectionHeading n={nextSection()} title="Why this website is losing customers" />
                <ol className="space-y-6">
                  {report.ai.topProblems.map((p, i) => (
                    <li key={i} className="grid grid-cols-[48px_1fr] gap-4">
                      <span className="font-display text-4xl font-semibold leading-none text-gold-500/80">{i + 1}</span>
                      <div>
                        <h3 className="font-display text-xl font-semibold text-ink-900">{p.title}</h3>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{p.explanation}</p>
                        <p className="mt-2 inline-block rounded-lg bg-rose-50 px-3 py-1.5 text-sm text-rose-800">
                          <span className="font-semibold">Business impact:</span> {p.businessImpact}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>

              <div className="grid gap-8 md:grid-cols-2">
                <Card>
                  <SectionHeading n={nextSection()} title="Design & first impression" />
                  <ul className="space-y-3">
                    {report.ai.designObservations.map((d, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-slate-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold-500" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <SectionHeading n={nextSection()} title="Quick wins" />
                  <ul className="space-y-3">
                    {report.ai.quickWins.map((d, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-slate-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] text-emerald-700 ring-1 ring-emerald-200">✓</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <blockquote className="break-inside-avoid rounded-2xl border-l-2 border-gold-500 bg-ivory px-8 py-7 font-display text-xl italic leading-relaxed text-ink-800 shadow-sm ring-1 ring-gold-100">
                {report.ai.pitch}
              </blockquote>
            </>
          )}

          <div>
            <SectionHeading n={nextSection()} title="Detailed findings" kicker={`${allChecks.length} checks`} />
            <div className="space-y-4">
              {[...report.categories].sort((a, b) => a.score - b.score).map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
            </div>
          </div>

          <div id="video" className="no-print scroll-mt-20">
            <VideoStudio report={report} />
          </div>
        </div>
      )}
    </div>
  );
}
