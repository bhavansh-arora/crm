import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Deliberately unauthenticated: WhatsApp's own servers fetch this URL to
// build the message's link-preview thumbnail, and a lead tapping the link
// won't have our session cookie either.
export async function GET(_req: NextRequest, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const match = /^[a-f0-9-]+\.(jpg|png|webp|gif)$/.exec(filename);
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
