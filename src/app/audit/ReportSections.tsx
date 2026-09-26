import { mobileChecklist } from "@/lib/site-audit/checklist";
import type { AuditReport, FunnelItem } from "@/lib/site-audit/types";
import { Card, SectionHeading, tone } from "./report-ui";

type Props = { report: AuditReport; n: string };

function Tick({ ok, partial = false }: { ok: boolean; partial?: boolean }) {
  const cls = ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : partial ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${cls}`}>
      {ok ? "✓" : partial ? "~" : "✕"}
    </span>
  );
}

// ---------- Mobile: above the fold ----------
export function MobileSection({ report, n }: Props) {
  const checklist = mobileChecklist(report);
  const ai = report.ai?.mobileFirstImpression;
  return (
    <Card>
      <SectionHeading n={n} title="Mobile first impression" kicker="Above the fold · iPhone" />
      <div className="grid items-start gap-8 md:grid-cols-[280px_1fr]">
        <div className="mx-auto w-[260px]">
          <div className="relative rounded-[40px] bg-ink-950 p-3 shadow-2xl ring-1 ring-ink-700">
            <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-ink-950" />
            <div className="relative overflow-hidden rounded-[30px] bg-white">
              {report.mobileScreenshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={report.mobileScreenshot} alt={`${report.domain} on a phone, above the fold`} className="block w-full" />
              ) : (
                <div className="flex aspect-[375/812] items-center justify-center px-6 text-center text-sm text-slate-400">Mobile view unavailable</div>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-600">
            <span className="h-px flex-1 border-t-2 border-dashed border-gold-500" />
            The fold
            <span className="h-px flex-1 border-t-2 border-dashed border-gold-500" />
          </div>
          <p className="mt-1 text-center text-xs text-slate-500">This is everything a phone visitor sees before scrolling.</p>
        </div>
        <div>
          {ai && (
            <>
              <p className="text-[15px] leading-relaxed text-slate-700">{ai.whatVisitorsSee}</p>
              <p className="mt-3 font-display text-lg italic text-ink-900">{ai.verdict}</p>
            </>
          )}
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">What a phone visitor needs before scrolling</div>
          <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2.5 text-sm">
                <Tick ok={c.ok} />
                <span className="flex-1 text-slate-700">{c.label}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${c.ok ? "text-emerald-600" : "text-rose-600"}`}>{c.ok ? "Visible" : "Missing"}</span>
              </li>
            ))}
          </ul>
          {ai && ai.missingAboveFold.length > 0 && (
            <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
              <span className="font-semibold">Missing from the first screen: </span>
              {ai.missingAboveFold.join(" · ")}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------- Headline & messaging ----------
export function HeadlineSection({ report, n }: Props) {
  const { content } = report;
  const ai = report.ai?.headlineReview;
  const outline = content.headings.filter((h) => h.level <= 2).slice(0, 8);
  return (
    <Card>
      <SectionHeading n={n} title="Headline & messaging" kicker="The first words visitors read" />
      <div className="rounded-2xl bg-slate-50 p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Your headline today</div>
        <p className="mt-2 font-display text-2xl leading-snug text-ink-900 sm:text-3xl">
          {content.heroHeadline ? <>&ldquo;{content.heroHeadline}&rdquo;</> : <span className="italic text-rose-700">No clear headline found</span>}
        </p>
        {content.heroSubheadline && <p className="mt-2 text-[15px] text-slate-600">{content.heroSubheadline}</p>}
      </div>

      {ai && (
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-display text-lg italic text-ink-900">{ai.verdict}</p>
            <ul className="mt-3 space-y-2">
              {ai.problems.map((p, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-rose-500" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">Stronger headlines to test</div>
            <ol className="mt-3 space-y-3">
              {ai.rewrites.map((r, i) => (
                <li key={i} className="flex gap-3 rounded-xl bg-ink-900 px-4 py-3 text-ivory">
                  <span className="font-display text-gold-400">{i + 1}</span>
                  <span className="font-display text-lg leading-snug">{r}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {outline.length > 1 && (
        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Page outline (how the story flows)</div>
          <ol className="mt-2 space-y-1 text-sm">
            {outline.map((h, i) => (
              <li key={i} className={`flex gap-3 ${h.level === 1 ? "font-semibold text-ink-900" : "pl-6 text-slate-600"}`}>
                <span className="w-6 shrink-0 text-[11px] uppercase text-slate-400">H{h.level}</span>
                {h.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

// ---------- TOF / MOF / BOF ----------
function FunnelRow({ item }: { item: FunnelItem }) {
  return (
    <li className="flex gap-2.5 py-2 text-sm">
      <Tick ok={item.status === "yes"} partial={item.status === "partial"} />
      <div>
        <div className="font-medium text-ink-900">{item.label}</div>
        <div className="text-[13px] leading-snug text-slate-500">{item.note}</div>
      </div>
    </li>
  );
}

export function FunnelSection({ report, n }: Props) {
  const ai = report.ai?.funnel;
  const leak = ai?.biggestLeak ?? [...report.funnel].sort((a, b) => a.score - b.score)[0].id;
  return (
    <Card>
      <SectionHeading n={n} title="The marketing funnel" kicker="TOF · MOF · BOF" />
      <p className="mb-6 max-w-3xl text-[15px] leading-relaxed text-slate-600">
        A website has three jobs: get found and grab attention (<b>top of funnel</b>), build interest and trust (<b>middle</b>), and turn
        that interest into a call, WhatsApp message or enquiry (<b>bottom</b>). A leak at any stage loses customers.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {report.funnel.map((stage) => {
          const t = tone(stage.score);
          const isLeak = stage.id === leak;
          return (
            <div key={stage.id} className={`rounded-2xl p-5 ring-1 ${isLeak ? "bg-rose-50/40 ring-rose-300" : "ring-slate-200/80"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-600">{stage.id.toUpperCase()}</div>
                  <div className="font-display text-xl font-semibold text-ink-900">{stage.name}</div>
                  <div className="text-xs text-slate-500">{stage.goal}</div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-3xl font-semibold ${t.text}`}>{stage.score}</div>
                  {isLeak && <div className="mt-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Biggest leak</div>}
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${t.bar}`} style={{ width: `${stage.score}%` }} />
              </div>
              {ai && <p className="mt-4 text-[14px] leading-relaxed text-slate-700">{ai[stage.id]}</p>}
              <ul className="mt-3 divide-y divide-slate-100">
                {stage.items.map((item) => (
                  <FunnelRow key={item.label} item={item} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Testimonials & trust ----------
export function ProofSection({ report, n }: Props) {
  const { content } = report;
  const ai = report.ai?.socialProof;
  return (
    <Card>
      <SectionHeading n={n} title="Testimonials & trust" kicker={`${content.testimonials.length} testimonials found`} />
      {ai && <p className="mb-5 max-w-3xl font-display text-lg italic leading-relaxed text-ink-900">{ai.verdict}</p>}
      {content.testimonials.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {content.testimonials.map((q, i) => (
            <figure key={i} className="rounded-2xl bg-ivory p-5 ring-1 ring-gold-100">
              <div className="text-gold-500">★★★★★</div>
              <blockquote className="mt-2 font-display text-[17px] italic leading-relaxed text-ink-800">&ldquo;{q}&rdquo;</blockquote>
            </figure>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-rose-200 p-6 text-center">
          <div className="font-display text-xl text-rose-700">No testimonials found on the homepage</div>
          <p className="mt-1 text-sm text-slate-500">Nine in ten customers read reviews before they buy. Without visible proof, even a great business looks like a risk.</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Trust signals found</div>
          {content.trustSignals.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {content.trustSignals.map((t) => (
                <span key={t} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">None — no years in business, customer counts, ratings or certifications are shown.</p>
          )}
        </div>
        {ai && ai.recommendations.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">How to strengthen it</div>
            <ul className="mt-2 space-y-2">
              {ai.recommendations.map((r, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] text-emerald-700 ring-1 ring-emerald-200">✓</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
