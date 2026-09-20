"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FollowUp } from "@/types/models";

const NOTIFIED_KEY = "crm-notified-followups";
const POLL_MS = 30000;

function getNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markNotified(id: string) {
  const notified = getNotified();
  notified.add(id);
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]));
  } catch {
    // localStorage unavailable (private browsing, etc.) — notifications
    // may repeat across reloads, which is harmless.
  }
}

// Fires a real browser/desktop notification for each open follow-up that's
// due, as long as this tab is open — no email/SMTP setup required. Runs
// once from AppShell so it's active on every authenticated page.
export default function FollowUpNotifications() {
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;

    async function check() {
      try {
        const res = await fetch("/api/followups?scope=open");
        if (!res.ok) return;
        const data: { followUps: FollowUp[] } = await res.json();
        const now = Date.now();
        const notified = getNotified();

        for (const f of data.followUps) {
          if (notified.has(f.id)) continue;
          if (new Date(f.dueAt).getTime() > now) continue;

          const title = f.lead ? `Follow-up due: ${f.lead.name}` : "Follow-up due";
          const n = new Notification(title, {
            body: f.note || "Time to follow up on this lead.",
            tag: f.id,
          });
          n.onclick = () => {
            window.focus();
            router.push(`/leads/${f.leadId}`);
          };
          markNotified(f.id);
        }
      } catch {
        // Transient network failure — next poll will retry.
      }
    }

    check();
    const interval = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [permission, router]);

  if (permission !== "default") return null;

  return (
    <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800 ring-1 ring-brand-200">
      <span>Turn on browser notifications to get alerted here when a follow-up is due.</span>
      <button
        onClick={() => Notification.requestPermission().then(setPermission)}
        className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        Enable notifications
      </button>
    </div>
  );
}
