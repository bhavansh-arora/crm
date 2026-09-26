import { safeFetch, type SafeResponse } from "./safe-fetch";
import { BUY_RE, isStorePage, PAYMENT_RE } from "./site-type";
import type { AuditCategory, AuditCheck, CategoryId, CheckStatus, Severity } from "./types";

// Heuristic, dependency-free checks run against the raw HTML + response
// headers. Regex-based parsing is deliberately forgiving: it's reading real
// small-business sites, which are often not well-formed.

type Tag = { name: string; attrs: Record<string, string>; raw: string; index: number };

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    attrs[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  }
  return attrs;
}

export function findTags(html: string, name: string): Tag[] {
  const re = new RegExp(`<${name}(\\s[^>]*)?>`, "gi");
  const tags: Tag[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    tags.push({ name, attrs: parseAttrs(m[1] || ""), raw: m[0], index: m.index });
  }
  return tags;
}

export function innerTexts(html: string, name: string): string[] {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(stripTags(m[1]));
  return out;
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function metaContent(metas: Tag[], key: string): string | null {
  const m = metas.find((t) => (t.attrs.name || t.attrs.property || "").toLowerCase() === key);
  return m ? m.attrs.content ?? "" : null;
}

const CATEGORY_NAMES: Record<CategoryId, string> = {
  security: "Security & Trust",
  performance: "Speed & Performance",
  seo: "Google / SEO Visibility",
  mobile: "Mobile Experience",
  accessibility: "Accessibility",
  conversion: "Lead Generation & Conversion",
  technology: "Code Quality & Modernity",
};

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function scoreCategory(checks: AuditCheck[]): number {
  let total = 0;
  let earned = 0;
  for (const c of checks) {
    if (c.status === "info") continue;
    const w = SEVERITY_WEIGHT[c.severity];
    total += w;
    earned += c.status === "pass" ? w : c.status === "warn" ? w * 0.5 : 0;
  }
  return total === 0 ? 100 : Math.round((earned / total) * 100);
}

class CheckList {
  checks: Record<CategoryId, AuditCheck[]> = {
    security: [],
    performance: [],
    seo: [],
    mobile: [],
    accessibility: [],
    conversion: [],
    technology: [],
  };

  add(
    category: CategoryId,
    id: string,
    title: string,
    status: CheckStatus,
    severity: Severity,
    detail: string,
    extra: { impact?: string; fix?: string } = {}
  ) {
    const check: AuditCheck = { id, title, status, severity, detail };
    if (status !== "pass" && status !== "info") {
      if (extra.impact) check.impact = extra.impact;
      if (extra.fix) check.fix = extra.fix;
    }
    this.checks[category].push(check);
  }

  categories(): AuditCategory[] {
    return (Object.keys(this.checks) as CategoryId[]).map((id) => ({
      id,
      name: CATEGORY_NAMES[id],
      score: scoreCategory(this.checks[id]),
      checks: this.checks[id],
    }));
  }
}

async function tryFetch(url: string, opts?: Parameters<typeof safeFetch>[1]): Promise<SafeResponse | null> {
  try {
    return await safeFetch(url, opts);
  } catch {
    return null;
  }
}

export type HtmlAnalysis = {
  finalUrl: string;
  responseTimeMs: number;
  pageTitle: string | null;
  categories: AuditCategory[];
  // Short text excerpt of the page, handed to the AI for context.
  textExcerpt: string;
  isStore: boolean;
  html: string;
};

export async function analyzeSite(inputUrl: string): Promise<HtmlAnalysis> {
  const res = await safeFetch(inputUrl);
  if (res.status >= 400) {
    throw new Error(`The website responded with an error (HTTP ${res.status})`);
  }
  const html = res.body.toString("utf8");
  const final = new URL(res.finalUrl);
  const origin = final.origin;
  const list = new CheckList();

  const lower = html.toLowerCase();
  const headEnd = lower.indexOf("</head>");
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 20000);
  const bodyText = stripTags(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
  );
  const wordCount = bodyText.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

  const metas = findTags(html, "meta");
  const links = findTags(html, "link");
  const scripts = findTags(html, "script");
  const imgs = findTags(html, "img");
  const anchors = findTags(html, "a");
  const hdr = (k: string) => res.headers.get(k);

  // ---------- Security ----------
  const isHttps = final.protocol === "https:";
  list.add("security", "https", "Secure connection (HTTPS)", isHttps ? "pass" : "fail", "critical",
    isHttps ? "The site loads over an encrypted HTTPS connection." : "The site loads over plain HTTP — browsers show a \"Not Secure\" warning next to the address.",
    { impact: "Visitors see \"Not Secure\" and many leave immediately; Google ranks non-HTTPS sites lower.", fix: "Install a free SSL certificate (e.g. Let's Encrypt) and redirect all traffic to https://." });

  if (isHttps) {
    const httpRes = await tryFetch(`http://${final.host}${final.pathname}`, { method: "HEAD", timeoutMs: 8000, maxRedirects: 3 });
    const redirectsToHttps = httpRes ? httpRes.finalUrl.startsWith("https:") : null;
    if (redirectsToHttps !== null) {
      list.add("security", "http-redirect", "HTTP redirects to HTTPS", redirectsToHttps ? "pass" : "warn", "medium",
        redirectsToHttps ? "Typing the address without https:// still lands on the secure version." : "The insecure http:// version of the site does not redirect to https://.",
        { impact: "Some visitors land on an insecure copy of the site.", fix: "Add a permanent (301) redirect from http:// to https://." });
    }
  }

  const mixed = [...imgs, ...scripts, ...links.filter((l) => /stylesheet/i.test(l.attrs.rel || ""))].filter((t) =>
    /^http:\/\//i.test(t.attrs.src || t.attrs.href || "")
  );
  if (isHttps) {
    list.add("security", "mixed-content", "No insecure (mixed) content", mixed.length ? "fail" : "pass", "high",
      mixed.length ? `${mixed.length} image/script/style file(s) are loaded over insecure http:// on a secure page.` : "All resources are loaded securely.",
      { impact: "Browsers block or flag these files — images go missing and the padlock disappears.", fix: "Change these resource links to https://." });
  }

  const hsts = hdr("strict-transport-security");
  list.add("security", "hsts", "HSTS header", hsts ? "pass" : "warn", "low",
    hsts ? "Browsers are told to always use HTTPS." : "No Strict-Transport-Security header is sent.",
    { impact: "Leaves visitors open to downgrade attacks on public Wi-Fi.", fix: "Send a Strict-Transport-Security header from the server." });

  const clickjack = hdr("x-frame-options") || /frame-ancestors/i.test(hdr("content-security-policy") || "");
  list.add("security", "clickjacking", "Clickjacking protection", clickjack ? "pass" : "warn", "low",
    clickjack ? "The site can't be embedded in malicious frames." : "No X-Frame-Options / frame-ancestors protection.",
    { impact: "Attackers can embed the site invisibly to trick visitors into clicks.", fix: "Send X-Frame-Options: SAMEORIGIN." });

  list.add("security", "nosniff", "Content-type sniffing protection", hdr("x-content-type-options") ? "pass" : "warn", "low",
    hdr("x-content-type-options") ? "X-Content-Type-Options is set." : "X-Content-Type-Options header is missing.",
    { fix: "Send X-Content-Type-Options: nosniff." });

  const leak = [hdr("x-powered-by"), hdr("server")].filter((v): v is string => !!v && /\d/.test(v));
  list.add("security", "version-leak", "Server software versions hidden", leak.length ? "warn" : "pass", "low",
    leak.length ? `The server announces its exact software version (${leak.join(", ")}).` : "Server software versions are not exposed.",
    { impact: "Makes it easy for bots to find known vulnerabilities for that version.", fix: "Hide version numbers in the Server / X-Powered-By headers." });

  // ---------- Performance ----------
  const ttfb = res.timeMs;
  list.add("performance", "response-time", "Server response time", ttfb < 800 ? "pass" : ttfb < 1800 ? "warn" : "fail", "high",
    `The page took ${(ttfb / 1000).toFixed(2)}s to respond from our server.`,
    { impact: "53% of mobile visitors leave a site that takes over 3 seconds to load.", fix: "Use better hosting, enable page caching, or put the site behind a CDN." });

  const htmlKb = Math.round(res.body.length / 1024);
  list.add("performance", "html-size", "Page HTML size", htmlKb < 150 ? "pass" : htmlKb < 400 ? "warn" : "fail", "medium",
    `The HTML document alone is ${htmlKb} KB.`,
    { impact: "Bloated pages load slowly on mobile data.", fix: "Remove unused page-builder markup, inline styles and scripts." });

  const encoding = hdr("content-encoding");
  list.add("performance", "compression", "Compression (gzip/brotli)", encoding ? "pass" : "fail", "medium",
    encoding ? `Content is compressed (${encoding}).` : "The page is sent uncompressed.",
    { impact: "Pages take 3-5x longer to download than necessary.", fix: "Enable gzip or brotli compression on the web server." });

  const externalScripts = scripts.filter((s) => s.attrs.src);
  const blocking = findTags(head, "script").filter(
    (s) => s.attrs.src && !("async" in s.attrs) && !("defer" in s.attrs) && (s.attrs.type || "text/javascript").includes("javascript")
  );
  list.add("performance", "render-blocking", "Render-blocking scripts", blocking.length === 0 ? "pass" : blocking.length <= 3 ? "warn" : "fail", "medium",
    blocking.length ? `${blocking.length} script(s) in the page head block the page from appearing until they download.` : "No render-blocking scripts in the head.",
    { impact: "Visitors stare at a blank white screen for longer.", fix: "Add async/defer to scripts or move them to the end of the page." });

  const cssFiles = links.filter((l) => /stylesheet/i.test(l.attrs.rel || ""));
  const requests = externalScripts.length + cssFiles.length;
  list.add("performance", "request-count", "Number of script & style files", requests <= 20 ? "pass" : requests <= 40 ? "warn" : "fail", "medium",
    `The page loads ${externalScripts.length} script files and ${cssFiles.length} stylesheets.`,
    { impact: "Every extra file adds loading time, especially on phones.", fix: "Remove unused plugins and combine/minify files." });

  const lazy = imgs.filter((i) => i.attrs.loading === "lazy").length;
  if (imgs.length > 5) {
    list.add("performance", "lazy-images", "Images load lazily", lazy > 0 ? "pass" : "warn", "low",
      lazy ? `${lazy} of ${imgs.length} images load only when scrolled into view.` : `None of the ${imgs.length} images use lazy loading.`,
      { fix: "Add loading=\"lazy\" to images below the fold." });
  }
  const modernImg = imgs.filter((i) => /\.(webp|avif)(\?|$)/i.test(i.attrs.src || "")).length + findTags(html, "source").filter((s) => /webp|avif/i.test(s.attrs.type || s.attrs.srcset || "")).length;
  if (imgs.length > 3) {
    list.add("performance", "modern-images", "Modern image formats", modernImg > 0 ? "pass" : "warn", "low",
      modernImg ? "Some images use modern WebP/AVIF formats." : "All images use older JPG/PNG/GIF formats.",
      { impact: "Images are often 30-50% larger than they need to be.", fix: "Serve WebP or AVIF versions of images." });
  }

  // ---------- SEO ----------
  const title = innerTexts(head, "title")[0] || null;
  const tLen = title?.length ?? 0;
  list.add("seo", "title", "Page title", !title ? "fail" : tLen < 15 || tLen > 65 ? "warn" : "pass", "high",
    !title ? "The page has no title — Google has nothing to show in search results." : `Title (${tLen} chars): "${title}"`,
    { impact: "The title is the blue link people click on Google.", fix: "Write a 30-60 character title with the business name, service and city." });

  const desc = metaContent(metas, "description");
  list.add("seo", "meta-description", "Meta description", !desc ? "fail" : desc.length < 50 || desc.length > 170 ? "warn" : "pass", "medium",
    !desc ? "No meta description — Google will guess a random snippet." : `Description is ${desc.length} characters.`,
    { impact: "A good description gets more people to click the search result.", fix: "Add a 120-160 character description that sells the business." });

  const h1s = innerTexts(html, "h1").filter(Boolean);
  list.add("seo", "h1", "Main heading (H1)", h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn", "medium",
    h1s.length === 0 ? "The page has no main heading (H1)." : h1s.length === 1 ? `Main heading: "${h1s[0].slice(0, 90)}"` : `The page has ${h1s.length} H1 headings — search engines expect one.`,
    { impact: "Google uses the main heading to understand what the business does.", fix: "Use exactly one H1 stating the core service." });

  const canonical = links.find((l) => (l.attrs.rel || "").toLowerCase() === "canonical");
  list.add("seo", "canonical", "Canonical URL", canonical ? "pass" : "warn", "low",
    canonical ? "A canonical URL is set." : "No canonical URL tag.",
    { fix: "Add <link rel=\"canonical\"> to prevent duplicate-content issues." });

  const robotsMeta = metaContent(metas, "robots") || "";
  list.add("seo", "indexable", "Page can appear on Google", /noindex/i.test(robotsMeta) ? "fail" : "pass", "critical",
    /noindex/i.test(robotsMeta) ? "The page tells Google NOT to index it (noindex)." : "The page is allowed in search results.",
    { impact: "The site is invisible on Google.", fix: "Remove the noindex robots tag." });

  const [robotsTxt, sitemap] = await Promise.all([
    tryFetch(`${origin}/robots.txt`, { timeoutMs: 8000, maxBytes: 200_000 }),
    tryFetch(`${origin}/sitemap.xml`, { timeoutMs: 8000, maxBytes: 200_000 }),
  ]);
  const robotsOk = robotsTxt && robotsTxt.status === 200 && !/<html/i.test(robotsTxt.body.toString("utf8", 0, 500));
  list.add("seo", "robots-txt", "robots.txt file", robotsOk ? "pass" : "warn", "low",
    robotsOk ? "robots.txt exists." : "No robots.txt file found.",
    { fix: "Add a robots.txt that points search engines to the sitemap." });
  const robotsSitemap = robotsOk && /sitemap:/i.test(robotsTxt!.body.toString("utf8"));
  const sitemapOk = (sitemap && sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body.toString("utf8", 0, 2000))) || robotsSitemap;
  list.add("seo", "sitemap", "XML sitemap", sitemapOk ? "pass" : "warn", "medium",
    sitemapOk ? "An XML sitemap was found." : "No XML sitemap was found.",
    { impact: "Google may miss pages and index new content slowly.", fix: "Generate a sitemap.xml and submit it in Google Search Console." });

  const ogTitle = metaContent(metas, "og:title");
  const ogImage = metaContent(metas, "og:image");
  list.add("seo", "social-preview", "Social sharing preview", ogTitle && ogImage ? "pass" : ogTitle || ogImage ? "warn" : "fail", "medium",
    ogTitle && ogImage ? "Links shared on WhatsApp/Facebook show a proper preview." : "Links shared on WhatsApp, Facebook or LinkedIn show no proper preview image/title.",
    { impact: "Shared links look broken and get far fewer clicks.", fix: "Add Open Graph tags (og:title, og:description, og:image)." });

  const hasSchema = /application\/ld\+json/i.test(html) || /itemtype=["']https?:\/\/schema\.org/i.test(html);
  list.add("seo", "structured-data", "Structured data (schema.org)", hasSchema ? "pass" : "warn", "medium",
    hasSchema ? "Structured data found — eligible for rich Google results." : "No structured data — no star ratings, hours or address in Google results.",
    { impact: "Competitors with schema get bigger, richer search listings.", fix: "Add LocalBusiness / Organization JSON-LD schema." });

  list.add("seo", "content-length", "Amount of text content", wordCount >= 300 ? "pass" : wordCount >= 120 ? "warn" : "fail", "medium",
    `The page has about ${wordCount} words of visible text.`,
    { impact: "Thin pages rarely rank on Google and don't convince visitors.", fix: "Add clear copy about services, areas served, pricing and FAQs." });

  // ---------- Mobile ----------
  const viewport = metaContent(metas, "viewport");
  list.add("mobile", "viewport", "Mobile-friendly layout", viewport && /width\s*=\s*device-width/i.test(viewport) ? "pass" : "fail", "critical",
    viewport ? `Viewport: "${viewport}"` : "No mobile viewport tag — on phones the site shows as a tiny zoomed-out desktop page.",
    { impact: "Over 70% of visitors browse on phones; Google ranks by the mobile version.", fix: "Rebuild with a responsive layout and add a device-width viewport tag." });

  if (viewport && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport)) {
    list.add("mobile", "zoom", "Pinch-to-zoom allowed", "warn", "low", "Zooming is disabled on mobile.",
      { impact: "People with poor eyesight can't read the text.", fix: "Remove user-scalable=no / maximum-scale=1." });
  } else if (viewport) {
    list.add("mobile", "zoom", "Pinch-to-zoom allowed", "pass", "low", "Visitors can zoom on mobile.");
  }

  const fixedWidth = /(?:style=["'][^"']*|{[^}]*)\bwidth\s*:\s*(9[6-9]\d|1\d{3})px/i.test(html) || /<table[^>]+width=["']?(9[6-9]\d|1\d{3})/i.test(html);
  list.add("mobile", "fixed-width", "No fixed desktop widths", fixedWidth ? "warn" : "pass", "medium",
    fixedWidth ? "Found fixed pixel widths (960px+) that force sideways scrolling on phones." : "No large fixed-width layout found.",
    { fix: "Replace fixed widths with fluid (max-width / %) layouts." });

  // Online stores / sales pages convert through a buy button, not phone
  // calls or enquiry forms, so those checks don't count against them.
  const isStore = isStorePage(html, bodyText);
  const telLinks = anchors.filter((a) => /^tel:/i.test(a.attrs.href || ""));
  if (isStore) {
    list.add("mobile", "tap-to-call", "Tap-to-call phone link", telLinks.length ? "pass" : "info", "low",
      telLinks.length ? "Phone number is a tappable call link." : "No phone link — fine for an online store, where the buy button does the selling.");
  } else {
    list.add("mobile", "tap-to-call", "Tap-to-call phone link", telLinks.length ? "pass" : "fail", "high",
      telLinks.length ? "Phone number is a tappable call link." : "No tap-to-call link — mobile visitors must copy the number by hand.",
      { impact: "Every extra step loses calls from ready-to-buy customers.", fix: "Wrap the phone number in a tel: link, ideally as a sticky Call button." });
  }

  const icon = links.find((l) => /icon/i.test(l.attrs.rel || ""));
  list.add("mobile", "favicon", "Favicon / app icon", icon ? "pass" : "warn", "low",
    icon ? "Site has a favicon." : "No favicon — the browser tab shows a blank/generic icon.",
    { impact: "Looks unfinished and unprofessional.", fix: "Add a favicon and apple-touch-icon." });

  // ---------- Accessibility ----------
  const htmlTag = findTags(html, "html")[0];
  list.add("accessibility", "lang", "Page language declared", htmlTag?.attrs.lang ? "pass" : "warn", "low",
    htmlTag?.attrs.lang ? `Language: ${htmlTag.attrs.lang}` : "The page doesn't declare its language.",
    { fix: "Add lang=\"en\" (or the right language) to the <html> tag." });

  const missingAlt = imgs.filter((i) => !("alt" in i.attrs)).length;
  if (imgs.length) {
    const ratio = missingAlt / imgs.length;
    list.add("accessibility", "alt-text", "Image descriptions (alt text)", missingAlt === 0 ? "pass" : ratio < 0.3 ? "warn" : "fail", "medium",
      missingAlt ? `${missingAlt} of ${imgs.length} images have no alt text.` : `All ${imgs.length} images have alt text.`,
      { impact: "Blind visitors can't understand the images, and Google Images can't index them.", fix: "Describe each meaningful image with alt text." });
  }

  const inputs = findTags(html, "input").filter((i) => !["hidden", "submit", "button", "image", "reset"].includes((i.attrs.type || "text").toLowerCase()));
  const labelFor = new Set(findTags(html, "label").map((l) => l.attrs.for).filter(Boolean));
  const unlabeled = inputs.filter((i) => !(i.attrs.id && labelFor.has(i.attrs.id)) && !i.attrs["aria-label"] && !i.attrs["aria-labelledby"]).length;
  if (inputs.length) {
    list.add("accessibility", "form-labels", "Form fields are labelled", unlabeled === 0 ? "pass" : "warn", "medium",
      unlabeled ? `${unlabeled} of ${inputs.length} form fields have no proper label.` : "All form fields have labels.",
      { fix: "Give every form field a <label> or aria-label." });
  }

  const vagueLinks = innerTexts(html, "a").filter((t) => /^(click here|here|read more|more|learn more)$/i.test(t)).length;
  list.add("accessibility", "link-text", "Descriptive link text", vagueLinks === 0 ? "pass" : "warn", "low",
    vagueLinks ? `${vagueLinks} links just say "click here" / "read more".` : "Links use descriptive text.",
    { fix: "Make link text describe where it goes (e.g. \"See our pricing\")." });

  // ---------- Conversion ----------
  const textLower = bodyText.toLowerCase();
  const hasPhone = telLinks.length > 0 || /(\+?\d[\d\s().-]{8,}\d)/.test(bodyText);
  if (isStore) {
    list.add("conversion", "phone", "Phone number visible", hasPhone ? "pass" : "info", "low",
      hasPhone ? "A phone number is shown on the page." : "No phone number — not essential for an online store.");
  } else {
    list.add("conversion", "phone", "Phone number visible", hasPhone ? "pass" : "fail", "high",
      hasPhone ? "A phone number is shown on the page." : "No phone number found on the homepage.",
      { impact: "Visitors who want to call have no way to — they call a competitor.", fix: "Show the phone number in the header of every page." });
  }

  const hasEmail = anchors.some((a) => /^mailto:/i.test(a.attrs.href || "")) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(bodyText);
  list.add("conversion", "email", "Email contact", hasEmail ? "pass" : "warn", "low",
    hasEmail ? "An email address is available." : "No email address found.",
    { fix: "Show a clickable email address." });

  const hasForm = findTags(html, "form").length > 0 || /(typeform|jotform|hubspot|wpcf7|gform|calendly)/i.test(lower);
  if (isStore) {
    const support = hasForm || anchors.some((a) => /contact|support|help/i.test(a.attrs.href || ""));
    list.add("conversion", "contact-form", "Support / contact option", support ? "pass" : "warn", "low",
      support ? "Buyers can reach support before purchasing." : "No visible way to contact support.",
      { impact: "Buyers with a last-minute doubt have nowhere to ask.", fix: "Link a contact or support page in the header and footer." });
  } else {
    list.add("conversion", "contact-form", "Enquiry / booking form", hasForm ? "pass" : "fail", "high",
      hasForm ? "The page has a form visitors can fill in." : "No enquiry or booking form on the homepage.",
      { impact: "Visitors browsing at night or at work can't leave their details — those leads are lost.", fix: "Add a short enquiry form (name, phone, need) above the fold." });
  }

  const hasWhatsApp = /(wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/)/i.test(lower);
  list.add("conversion", "whatsapp", "WhatsApp chat button", hasWhatsApp ? "pass" : "warn", isStore ? "low" : "medium",
    hasWhatsApp ? "Visitors can message on WhatsApp in one tap." : "No WhatsApp chat link.",
    { impact: "Most customers prefer messaging over calling or email.", fix: "Add a floating WhatsApp button." });

  const ctaRe = /\b(call now|call us|book|get (a )?(free )?(quote|estimate|started)|contact us|enquire|inquire|request|schedule|buy now|order now|sign up|get in touch|free consultation|shop now)\b/i;
  const buttonsText = [...innerTexts(html, "a"), ...innerTexts(html, "button")].join(" | ");
  const hasCta = ctaRe.test(buttonsText) || BUY_RE.test(buttonsText);
  list.add("conversion", "cta", "Clear call-to-action", hasCta ? "pass" : "fail", "high",
    hasCta ? "The page has clear action buttons (e.g. \"Contact us\", \"Get a quote\")." : "No clear call-to-action buttons like \"Get a Quote\" or \"Book Now\".",
    { impact: "Visitors don't know what to do next, so they leave.", fix: "Add a prominent, repeated CTA button telling visitors exactly what to do." });

  const hasTrust = /(testimonial|review|rated|stars?\b|trusted by|happy (customers|clients)|google reviews|trustpilot|case stud|success stor|real (people|results|customers)|what (our )?(customers|clients|students|members) (say|said)|\d[\d,]*\+?\s*(people|customers|students|members|buyers))/i.test(textLower);
  list.add("conversion", "social-proof", "Reviews / testimonials", hasTrust ? "pass" : "warn", "medium",
    hasTrust ? "The page shows reviews or testimonials." : "No reviews, testimonials or trust signals found.",
    { impact: "92% of people read reviews before buying — no proof means no trust.", fix: "Embed Google reviews and customer testimonials." });

  if (isStore) {
    const payments = PAYMENT_RE.test(html);
    list.add("conversion", "payment-options", "Payment options shown", payments ? "pass" : "warn", "medium",
      payments ? "Payment methods (UPI, cards…) are visible near checkout." : "No payment method badges shown.",
      { impact: "Buyers hesitate when they can't see how they'll pay.", fix: "Show UPI, card and wallet logos next to the buy button." });
    const guarantee = /(money[- ]back|refund|guarantee|no questions asked)/i.test(textLower);
    list.add("conversion", "guarantee", "Guarantee / risk reversal", guarantee ? "pass" : "warn", "medium",
      guarantee ? "A guarantee or refund promise removes the risk of buying." : "No guarantee or refund promise.",
      { impact: "Without a guarantee, the buyer carries all the risk — many won't.", fix: "Offer a clear money-back guarantee next to the price." });
  }

  const hasAnalytics = /(googletagmanager\.com|google-analytics\.com|gtag\(|fbq\(|connect\.facebook\.net|clarity\.ms|hotjar|plausible|posthog)/i.test(lower);
  list.add("conversion", "analytics", "Visitor tracking / analytics", hasAnalytics ? "pass" : "fail", "medium",
    hasAnalytics ? "Analytics/tracking is installed." : "No analytics installed — the owner has no idea how many visitors come or where they drop off.",
    { impact: "Can't measure ads, can't retarget visitors, can't improve.", fix: "Install Google Analytics 4 and the Meta Pixel." });

  const socials = ["facebook.com", "instagram.com", "linkedin.com", "youtube.com", "x.com", "twitter.com"].filter((s) =>
    anchors.some((a) => (a.attrs.href || "").toLowerCase().includes(s))
  );
  list.add("conversion", "social-links", "Social media links", socials.length ? "pass" : "warn", "low",
    socials.length ? `Links to ${socials.join(", ")}.` : "No links to social media profiles.",
    { fix: "Link to active social profiles to build credibility." });

  const privacy = anchors.some((a) => /privacy/i.test(a.attrs.href || "")) || /privacy policy/i.test(textLower);
  list.add("conversion", "privacy", "Privacy policy", privacy ? "pass" : "warn", "low",
    privacy ? "A privacy policy is linked." : "No privacy policy link found.",
    { impact: "Required to run Google/Meta ads and to collect leads legally.", fix: "Add a privacy policy page linked in the footer." });

  // ---------- Technology ----------
  const currentYear = new Date().getFullYear();
  const copyrightYears = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  if (copyrightYears.length) {
    const latest = Math.max(...copyrightYears);
    list.add("technology", "copyright", "Copyright year up to date", latest >= currentYear - 1 ? "pass" : "fail", "medium",
      latest >= currentYear - 1 ? `Footer copyright year is ${latest}.` : `Footer still says © ${latest} — the site looks abandoned.`,
      { impact: "Visitors assume the business may have closed.", fix: "Update the footer (or make the year automatic)." });
  }

  const hasDoctype = /^\s*(<!--[\s\S]*?-->\s*)*<!doctype html/i.test(html);
  list.add("technology", "doctype", "Modern HTML5 document", hasDoctype ? "pass" : "warn", "low",
    hasDoctype ? "Uses the HTML5 doctype." : "Missing or outdated doctype — browsers render in legacy \"quirks\" mode.",
    { fix: "Start the page with <!DOCTYPE html>." });

  const deprecated = ["font", "center", "marquee", "blink", "frameset", "frame"].filter((t) => new RegExp(`<${t}[\\s>]`, "i").test(html));
  list.add("technology", "deprecated-tags", "No obsolete HTML tags", deprecated.length ? "fail" : "pass", "medium",
    deprecated.length ? `Uses obsolete tags from the 1990s/2000s: <${deprecated.join(">, <")}>.` : "No obsolete HTML tags found.",
    { impact: "A clear sign the site hasn't been rebuilt in 10+ years.", fix: "Rebuild the site with modern HTML & CSS." });

  const flash = /(\.swf\b|application\/x-shockwave-flash)/i.test(html);
  if (flash) {
    list.add("technology", "flash", "No Flash content", "fail", "high", "The page still embeds Adobe Flash, which no browser supports since 2021.",
      { impact: "That part of the site is completely blank for every visitor.", fix: "Replace Flash with HTML5 video/images." });
  }

  const layoutTables = findTags(html, "table").filter((t) => /(width|cellpadding|border)=/i.test(t.raw)).length;
  list.add("technology", "table-layout", "No table-based layout", layoutTables >= 3 ? "fail" : layoutTables ? "warn" : "pass", "medium",
    layoutTables ? `${layoutTables} old-style layout tables found.` : "Layout doesn't rely on HTML tables.",
    { impact: "Table layouts can't adapt to phone screens.", fix: "Use a responsive CSS layout (flexbox/grid)." });

  const jq = html.match(/jquery[.-]?(\d+)\.(\d+)(?:\.(\d+))?(?:\.min)?\.js/i) || html.match(/jquery\/(\d+)\.(\d+)\.(\d+)\//i);
  if (jq) {
    const major = Number(jq[1]);
    list.add("technology", "jquery", "Up-to-date JavaScript libraries", major < 3 ? "fail" : "pass", "medium",
      `jQuery ${jq[1]}.${jq[2]}${jq[3] ? "." + jq[3] : ""} detected${major < 3 ? " — this version has known security vulnerabilities" : ""}.`,
      { fix: "Upgrade jQuery to 3.x or remove it." });
  }

  const generator = metaContent(metas, "generator");
  if (generator) {
    const wpVer = generator.match(/wordpress\s*([\d.]+)/i);
    const outdatedWp = wpVer && Number(wpVer[1].split(".")[0]) < 6;
    list.add("technology", "cms", "CMS / platform", outdatedWp ? "fail" : "info", outdatedWp ? "high" : "low",
      `Built with ${generator}${outdatedWp ? " — a WordPress version several years out of date" : ""}.`,
      { impact: "Outdated WordPress is the #1 cause of hacked small-business sites.", fix: "Update WordPress core, theme and plugins." });
  }

  const inlineStyles = (html.match(/\sstyle=["']/gi) || []).length;
  list.add("technology", "inline-styles", "Clean, maintainable code", inlineStyles > 150 ? "warn" : "pass", "low",
    inlineStyles > 150 ? `${inlineStyles} inline style attributes — typical of heavy page builders.` : "Styling is reasonably organised.",
    { fix: "Consolidate styles into a stylesheet." });

  // Sample a handful of internal links to catch broken pages.
  const internal = Array.from(
    new Set(
      anchors
        .map((a) => a.attrs.href || "")
        .filter((h) => h && !/^(#|mailto:|tel:|javascript:|whatsapp:)/i.test(h))
        .map((h) => {
          try {
            return new URL(h, final).toString().split("#")[0];
          } catch {
            return "";
          }
        })
        .filter((h) => h.startsWith(origin) && h !== final.toString())
    )
  ).slice(0, 12);
  if (internal.length) {
    const results = await Promise.all(internal.map((u) => tryFetch(u, { method: "GET", timeoutMs: 8000, maxBytes: 1 })));
    const broken = internal.filter((_, i) => !results[i] || results[i]!.status >= 400);
    list.add("technology", "broken-links", "Working internal links", broken.length === 0 ? "pass" : "fail", "high",
      broken.length ? `${broken.length} of ${internal.length} sampled links are broken: ${broken.slice(0, 3).map((b) => new URL(b).pathname).join(", ")}` : `All ${internal.length} sampled internal links work.`,
      { impact: "Broken pages frustrate visitors and hurt Google rankings.", fix: "Fix or redirect the broken links." });
  }

  return {
    finalUrl: res.finalUrl,
    responseTimeMs: res.timeMs,
    pageTitle: title,
    categories: list.categories(),
    textExcerpt: bodyText.slice(0, 3000),
    isStore,
    html,
  };
}
