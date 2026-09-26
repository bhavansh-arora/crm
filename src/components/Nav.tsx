"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string };

const ADMIN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "🗂️" },
  { href: "/followups", label: "Follow-ups", icon: "⏰" },
  { href: "/team", label: "Team", icon: "👥" },
];

// Shown in the top nav / mobile menu but not the bottom tab bar, to keep
// that bar to the 4 most-used destinations.
const ADMIN_SECONDARY_ITEMS: NavItem[] = [
  { href: "/dialer", label: "Dialer", icon: "📞" },
  { href: "/sources", label: "Sources", icon: "🏷️" },
  { href: "/activity", label: "Activity", icon: "📈" },
  { href: "/templates", label: "WhatsApp Templates", icon: "💬" },
  { href: "/audit", label: "Site Audit", icon: "🔍" },
];

const REP_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "My Leads", icon: "🗂️" },
  { href: "/dialer", label: "Dialer", icon: "📞" },
  { href: "/followups", label: "Follow-ups", icon: "⏰" },
];

const REP_SECONDARY_ITEMS: NavItem[] = [
  { href: "/templates", label: "WhatsApp Templates", icon: "💬" },
  { href: "/audit", label: "Site Audit", icon: "🔍" },
];

export default function Nav({ name, role }: { name: string; role: "ADMIN" | "SALES_REP" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = role === "ADMIN" ? ADMIN_ITEMS : REP_ITEMS;
  const secondaryItems = role === "ADMIN" ? ADMIN_SECONDARY_ITEMS : REP_SECONDARY_ITEMS;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              C
            </div>
            <span className="text-lg font-semibold">CRM</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {[...items, ...secondaryItems].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-slate-500">{name}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>

          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-slate-200 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 px-4 pb-3 md:hidden">
            <div className="flex flex-col gap-1 pt-2">
              {[...items, ...secondaryItems].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">{name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Bottom tab bar for quick mobile access */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => router.push(item.href)}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              isActive(item.href) ? "text-brand-700" : "text-slate-500"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
