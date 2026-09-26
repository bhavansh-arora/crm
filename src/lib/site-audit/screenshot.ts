// Full-page screenshot via thum.io's free tier. Fetched server-side
// and returned as a data: URL so the browser can draw it onto a canvas for
// the video without tainting it (cross-origin images can't be recorded).
export async function fetchThumScreenshot(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://image.thum.io/get/width/1280/crop/7000/noanimate/${url}`, {
      signal: AbortSignal.timeout(60_000),
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return null; // placeholder/error image
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
