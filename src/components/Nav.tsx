"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  Users,
  Receipt,
  Phone,
  Tag,
  LineChart,
  MessageSquare,
  PlusCircle,
  Menu,
  X,
  LogOut,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const ADMIN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: FolderKanban },
  { href: "/followups", label: "Follow-ups", icon: Clock },
  { href: "/team", label: "Team", icon: Users },
];

// Shown in the sidebar / mobile menu but not the bottom tab bar, to keep
// that bar to the 4 most-used destinations.
const ADMIN_SECONDARY_ITEMS: NavItem[] = [
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/dialer", label: "Dialer", icon: Phone },
  { href: "/sources", label: "Sources", icon: Tag },
  { href: "/activity", label: "Activity", icon: LineChart },
  { href: "/templates", label: "WhatsApp Templates", icon: MessageSquare },
];

// invoices.codebunny.net: just the invoicing pages.
const INVOICE_SITE_ITEMS: NavItem[] = [
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/invoices/new", label: "New invoice", icon: PlusCircle },
];

const REP_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "My Leads", icon: FolderKanban },
  { href: "/dialer", label: "Dialer", icon: Phone },
  { href: "/followups", label: "Follow-ups", icon: Clock },
];

const REP_SECONDARY_ITEMS: NavItem[] = [{ href: "/templates", label: "WhatsApp Templates", icon: MessageSquare }];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?";
  return letters.toUpperCase();
}

export default function Nav({
  name,
  role,
  invoicesSite = false,
}: {
  name: string;
  role: "ADMIN" | "SALES_REP";
  invoicesSite?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = invoicesSite ? INVOICE_SITE_ITEMS : role === "ADMIN" ? ADMIN_ITEMS : REP_ITEMS;
  const secondaryItems = invoicesSite ? [] : role === "ADMIN" ? ADMIN_SECONDARY_ITEMS : REP_SECONDARY_ITEMS;
  const brandLabel = invoicesSite ? "CodeBunny Invoices" : "CodeBunny CRM";

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    // On the invoices site "/invoices/new" is its own tab, so "Invoices"
    // shouldn't also light up there.
    if (invoicesSite && href === "/invoices") return pathname === href || /^\/invoices\/(?!new)/.test(pathname);
    return pathname === href || pathname.startsWith(href + "/");
  }

  const brandMark = (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-sm shadow-brand-600/30">
        {invoicesSite ? "🧾" : "C"}
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">{brandLabel}</span>
    </div>
  );

  function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-600" />}
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}`}
          strokeWidth={2}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  const userFooter = (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{name}</p>
          <p className="truncate text-xs text-slate-400">{role === "ADMIN" ? "Administrator" : "Sales Rep"}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        {brandMark}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          {secondaryItems.length > 0 && (
            <>
              <div className="my-3 h-px bg-slate-100" />
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">More</p>
              {secondaryItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </>
          )}
        </nav>
        {userFooter}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            {invoicesSite ? "🧾" : "C"}
          </div>
          <span className="text-base font-semibold tracking-tight text-slate-900">{brandLabel}</span>
        </div>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 ring-1 ring-slate-200"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">
                  {invoicesSite ? "🧾" : "C"}
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-slate-900">{brandLabel}</span>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
              ))}
              {secondaryItems.length > 0 && (
                <>
                  <div className="my-3 h-px bg-slate-100" />
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">More</p>
                  {secondaryItems.map((item) => (
                    <NavLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
                  ))}
                </>
              )}
            </nav>
            {userFooter}
          </div>
        </div>
      )}

      {/* Bottom tab bar for quick mobile access */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                active ? "text-brand-700" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
