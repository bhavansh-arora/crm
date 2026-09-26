import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError, ApiError } from "@/lib/api-auth";
import { runAudit } from "@/lib/site-audit";
import { FetchBlockedError, normalizeInputUrl } from "@/lib/site-audit/safe-fetch";

// Fetching the site, the screenshot and the AI write-up together can take
// a minute or two.
export const maxDuration = 300;

const bodySchema = z.object({ url: z.string().min(3).max(2000) });

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Enter a website URL");
    const report = await runAudit(normalizeInputUrl(parsed.data.url));
    return NextResponse.json({ report });
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
