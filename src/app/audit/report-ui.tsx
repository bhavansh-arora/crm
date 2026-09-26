import type { ReactNode } from "react";

export function tone(score: number) {
  return score >= 75
    ? { text: "text-emerald-700", bar: "bg-emerald-500", stroke: "#3fb68b", label: "Healthy" }
    : score >= 50
      ? { text: "text-amber-700", bar: "bg-amber-500", stroke: "#e0a93b", label: "Needs work" }
      : { text: "text-rose-700", bar: "bg-rose-500", stroke: "#e5484d", label: "Critical" };
}

export function SectionHeading({ n, title, kicker }: { n: string; title: string; kicker?: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-4 border-b border-slate-200 pb-3">
      <span className="font-display text-lg text-gold-600">{n}</span>
      <h2 className="font-display text-2xl font-semibold text-ink-900">{title}</h2>
      {kicker && <span className="ml-auto hidden text-xs uppercase tracking-[0.16em] text-slate-400 sm:block">{kicker}</span>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`break-inside-avoid rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8 ${className}`}>{children}</div>;
}
