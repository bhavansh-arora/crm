// Self-hosted (bundled from npm, no network needed at build time) and
// scoped to the audit page for an editorial, consulting-report feel; the
// rest of the CRM keeps the system font.
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-500-italic.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";

export const DISPLAY_FONT = `"Playfair Display", Georgia, serif`;
export const BODY_FONT = `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;

import type React from "react";

// Sets the CSS variables the tailwind `font-display` / `font-body` classes use.
export const fontVars = { "--font-display": DISPLAY_FONT, "--font-body": BODY_FONT } as React.CSSProperties;
