import { lookup } from "node:dns/promises";
import net from "node:net";

// The audit fetches arbitrary user-supplied URLs from our server, so every hop
// (including redirects) is checked against private/loopback/link-local ranges
// to stop the tool being used to probe internal services (SSRF).

export class FetchBlockedError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateIPv4(lower.slice(7));
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("ff")
  );
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchBlockedError("That doesn't look like a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchBlockedError("Only http:// and https:// URLs can be audited");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new FetchBlockedError("Only standard web ports (80/443) can be audited");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchBlockedError("Private/internal addresses can't be audited");
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new FetchBlockedError(`Couldn't find the website ${host} — check the spelling`);
  if (addresses.some((a) => isPrivateIP(a.address))) {
    throw new FetchBlockedError("Private/internal addresses can't be audited");
  }
  return url;
}

export type SafeResponse = {
  status: number;
  headers: Headers;
  finalUrl: string;
  redirects: string[];
  body: Buffer;
  timeMs: number;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 SiteAuditBot/1.0";

export async function safeFetch(
  raw: string,
  opts: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}
): Promise<SafeResponse> {
  const { method = "GET", timeoutMs = 15000, maxBytes = 5 * 1024 * 1024, maxRedirects = 5 } = opts;
  const redirects: string[] = [];
  let current = raw;
  const started = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Encoding": "gzip, deflate, br" },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, current).toString();
      redirects.push(next);
      current = next;
      await res.body?.cancel();
      continue;
    }

    const chunks: Uint8Array[] = [];
    let size = 0;
    if (method === "GET" && res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return {
      status: res.status,
      headers: res.headers,
      finalUrl: current,
      redirects,
      body: Buffer.concat(chunks),
      timeMs: Date.now() - started,
    };
  }
  throw new Error("Too many redirects");
}

export function normalizeInputUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
