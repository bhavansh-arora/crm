"use client";

import { useEffect } from "react";

const PING_MS = 60000;

// Pings /api/heartbeat while the app is open so admins can see who's
// currently active (and when each rep was last seen) on the Team/Activity
// pages. Mounted globally from AppShell.
export default function HeartbeatPing() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible") return;
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    }

    ping();
    const interval = setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
