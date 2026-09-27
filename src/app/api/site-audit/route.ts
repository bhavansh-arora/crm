import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError, ApiError } from "@/lib/api-auth";
import { runAudit } from "@/lib/site-audit";
import { FetchBlockedError, normalizeInputUrl } from "@/lib/site-audit/safe-fetch";
import { assertLeadAccess, saveAudit } from "@/lib/site-audit/store";

// Fetching the site, the screenshot and the AI write-up together can take
// a minute or two.
export const maxDuration = 300;

const bodySchema = z.object({ url: z.string().min(3).max(2000), leadId: z.string().optional().nullable() });

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Enter a website URL");
    const { leadId } = parsed.data;
    if (leadId) await assertLeadAccess(leadId, session);
    const report = await runAudit(normalizeInputUrl(parsed.data.url));
    // Every audit is saved so it can be reopened from the audits dashboard.
    // If saving fails, still hand back the report the user waited for.
    const saved = await saveAudit(report, { userId: session.user.id, leadId }).catch((err) => {
      console.error("Failed to save site audit", err);
      return null;
    });
    return NextResponse.json({ report, id: saved?.id ?? null });
  } catch (error) {
    if (error instanceof FetchBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && !(error instanceof ApiError)) {
      const msg =
        error.name === "TimeoutError" || error.name === "AbortError"
          ? "The website took too long to respond."
          : /fetch failed|ENOTFOUND|ECONNREFUSED|certificate/i.test(`${error.message} ${String(error.cause ?? "")}`)
            ? "Couldn't connect to that website — check the address is correct and the site is online."
            : error.message.startsWith("The website") || error.message === "Too many redirects"
              ? error.message
              : null;
      if (msg) return NextResponse.json({ error: msg }, { status: 422 });
    }
    return handleApiError(error);
  }
}
