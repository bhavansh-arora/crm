// Full-page screenshot via thum.io's free tier. Fetched server-side
// and returned as a data: URL so the browser can draw it onto a canvas for
// the video without tainting it (cross-origin images can't be recorded).
export function fetchThumScreenshot(url: string): Promise<string | null> {
  return fetchThum(`width/1280/fullpage/noanimate/${url}`);
}

// The first screen a phone visitor sees ("above the fold"): real iPhone
// emulation (375x812 viewport, mobile user agent), so the mobile layout,
// hamburger menus and cookie banners show exactly as they would.
export function fetchMobileScreenshot(url: string): Promise<string | null> {
  return fetchThum(`iphoneX/noanimate/${url}`);
}

async function fetchThum(path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://image.thum.io/get/${path}`, {
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
