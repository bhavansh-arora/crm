import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError, ApiError } from "@/lib/api-auth";

// Optional AI voiceover for the walkthrough video via ElevenLabs text-to-speech.
// Without ELEVENLABS_API_KEY the video falls back to the browser's built-in
// voice for live previews (which can't be recorded into the exported file).

const bodySchema = z.object({ text: z.string().min(1).max(1500) });

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ enabled: !!process.env.ELEVENLABS_API_KEY });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new ApiError(501, "AI voiceover isn't configured (ELEVENLABS_API_KEY)");
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid narration text");

    // Default voice: "Rachel", a clear, neutral narrator voice.
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: parsed.data.text, model_id: "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.error("ElevenLabs error", res.status, await res.text().catch(() => ""));
      throw new ApiError(502, `Voice generation failed (HTTP ${res.status})`);
    }
    return new NextResponse(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
