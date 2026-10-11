"use client";

import { useEffect, useRef } from "react";

const PING_MS = 60000;

// Matches the backend's SESSION_GAP_MS (src/app/api/admin/time-tracking) --
// once pings stop for this long, the gap they leave behind is already past
// the backend's own threshold for ending a session, so the two line up
// without needing a separate number to keep in sync.
const IDLE_THRESHOLD_MS = 3 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

// Pings /api/heartbeat while the app is open AND actually being used, so
// admins can see real active time on the Team/Activity pages -- a tab left
// open and visible on an unattended laptop (nobody touching the mouse or
// keyboard) stops pinging once idle, instead of counting as active time
// forever. Mounted globally from AppShell.
export default function HeartbeatPing() {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }

    function ping() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS) return;
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    }

    function onVisibilityChange() {
      // Switching back to the tab is itself a sign someone's there, even
      // before their next mouse move or keystroke.
      if (document.visibilityState === "visible") markActive();
      ping();
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, markActive, { passive: true });
    }
    ping();
    const interval = setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, markActive);
      }
    };
  }, []);

  return null;
}
