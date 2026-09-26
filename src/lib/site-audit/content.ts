import { findTags, innerTexts, stripTags } from "./analyze";
import { isStorePage, PAYMENT_RE, PRICE_RE } from "./site-type";
import type { AuditCategory, FunnelItem, FunnelStage, SiteContent } from "./types";

// Pulls out what the page actually *says* — headline, calls-to-action,
// testimonials, trust signals, key pages — and grades the site as a
// marketing funnel: TOF (get found, grab attention), MOF (build trust),
// BOF (turn interest into an enquiry).

const CTA_RE =
  /\b(call( us| now)?|book|get (a |your )?(free )?(quote|estimate|started|in touch|consultation|demo)|get (instant )?access|contact( us)?|enquire|inquire|request|schedule|buy|order|shop|add to (cart|bag)|checkout|enrol+|claim|unlock|sign ?up|subscribe|register|download|apply|join|start|try|whatsapp|chat)\b/i;

// "GET INSTANT ACCESS — ₹2,999 ₹599 →" → "Get instant access"
function ctaLabel(t: string): string {
  const stripped = t
    .replace(/[—–-]\s*(₹|rs\.?|\$|€|£)[\s\S]*$/i, "")
    .replace(/(₹|rs\.?|\$|€|£)\s?[\d,]+(\.\d+)?/gi, "")
    .replace(/[→›»>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped === stripped.toUpperCase() ? stripped.charAt(0) + stripped.slice(1).toLowerCase() : stripped;
}

function clean(s: string, max = 220): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t;
}

function visibleHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function extractTestimonials(html: string): string[] {
  const out: string[] = [];
  const blockRe =
    /<(div|section|article|li|figure|blockquote)\b[^>]*(?:class|id)=["'][^"']*(testimonial|review|feedback|quote|client-say|what-our)[^"']*["'][^>]*>([\s\S]{20,2500}?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && out.length < 8) {
    const text = stripTags(m[3]);
    if (text.split(" ").length >= 8) out.push(clean(text, 260));
  }
  for (const q of innerTexts(html, "blockquote")) {
    if (out.length >= 8) break;
    if (q.split(" ").length >= 8) out.push(clean(q, 260));
  }
  // De-duplicate nested matches (a wrapper and its inner card).
  const unique = [...new Set(out)];
  return unique.filter((t, i) => !unique.some((o, j) => j !== i && o.length > t.length && o.includes(t.slice(0, 60)))).slice(0, 4);
}

function extractTrustSignals(text: string): string[] {
  const found = new Map<string, string>();
  const patterns: RegExp[] = [
    /\b\d{1,3}(?:,\d{3})*\+?\s*(?:happy |satisfied )?(?:clients|customers|patients|students|projects|families|businesses|installations|orders|people|members|buyers|creators|sellers|subscribers|downloads|users)\b/gi,
    /\b\d+[kKmM]?\+?\s*(?:combined )?views\b/g,
    /\b\d+[- ]day(?:s)?\s+money[- ]back guarantee\b|\bmoney[- ]back guarantee\b/gi,
    /\b\d{1,2}\+?\s*years?(?: of)? (?:experience|in business|of service|of excellence|serving)\b/gi,
    /\b(?:since|established|estd\.?)\s*(?:in\s*)?(?:19|20)\d{2}\b/gi,
    /\b[1-5](?:\.\d)?\s*(?:\/\s*5|stars?|★)(?:\s*(?:rating|on google|google rating))?\b/gi,
    /\b(?:iso\s*\d{4,5}(?::\d{4})?|certified|award[- ]winning|accredited|licensed|registered|govt\.? approved|msme)\b/gi,
    /\b(?:as (?:seen|featured) (?:on|in)|trusted by)\b[^.]{0,40}/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const t = clean(m[0], 60);
      if (!found.has(t.toLowerCase())) found.set(t.toLowerCase(), t);
      if (found.size >= 8) break;
    }
  }
  return [...found.values()];
}

export function extractContent(html: string, finalUrl: string): SiteContent {
  const vis = visibleHtml(html);
  const bodyText = stripTags(vis);

  const headings: SiteContent["headings"] = [];
  const hRe = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = hRe.exec(vis)) && headings.length < 25) {
    const text = clean(stripTags(m[2]), 160);
    if (text) headings.push({ level: Number(m[1]), text });
  }

  const heroHeadline = headings.find((h) => h.level === 1)?.text ?? headings[0]?.text ?? null;
  let heroSubheadline: string | null = null;
  if (heroHeadline) {
    const idx = vis.search(/<h1\b/i);
    const after = idx >= 0 ? vis.slice(idx, idx + 4000) : vis.slice(0, 4000);
    const p = innerTexts(after, "p").find((t) => t.split(" ").length >= 5);
    heroSubheadline = p ? clean(p, 200) : null;
  }

  const anchors = findTags(vis, "a");
  const linkTexts = innerTexts(vis, "a");
  const buttonTexts = innerTexts(vis, "button");
  const ctas = Array.from(
    new Set(
      [...buttonTexts, ...linkTexts]
        .map((t) => ctaLabel(clean(t, 80)))
        .filter((t) => t && t.split(" ").length <= 7 && CTA_RE.test(t))
    )
  ).slice(0, 12);

  const hay = (anchors.map((a) => a.attrs.href || "").join(" ") + " " + linkTexts.join(" ")).toLowerCase();
  const has = (re: RegExp) => re.test(hay);
  const pages: SiteContent["pages"] = {
    about: has(/about|our[- ]story|who[- ]we[- ]are|team/),
    services: has(/services?|solutions|products?|treatments|courses|menu|what[- ]we[- ]do/),
    pricing: has(/pricing|prices?|packages?|plans|fees|rates/) || /₹\s?\d|rs\.?\s?\d|\$\s?\d/i.test(bodyText),
    faq: has(/faq|frequently|questions/) || headings.some((h) => /faq|frequently asked|questions/i.test(h.text)) || (vis.match(/<details\b/gi)?.length ?? 0) >= 3,
    blog: has(/blog|articles|news|insights|resources/),
    caseStudies: has(/case[- ]stud|portfolio|our[- ]work|projects|success[- ]stor/),
    contact: has(/contact|get[- ]in[- ]touch|reach[- ]us/),
    booking: has(/book|appointment|schedule|calendly|reserve/),
    gallery: has(/gallery|photos|showcase/),
  };

  void finalUrl;
  const siteType = isStorePage(html, bodyText) ? "store" : "business";
  const proofSection =
    headings.find((h) =>
      /testimonial|review|what (our |people |they )?(customers|clients|students|members|people)? ?(say|said)|success stor|real (people|results|launches|progress)|results|wins|love[ds]? by|case stud|not just us|hall of fame/i.test(h.text)
    )?.text ?? null;
  const hasDemoVideo = /<video\b|youtube\.com\/embed|youtu\.be|player\.vimeo\.com|wistia|vturb|loom\.com\/embed/i.test(html);
  // The lowest price shown is the one being charged (others are usually
  // struck-through "was" prices).
  const prices = [...bodyText.matchAll(new RegExp(PRICE_RE.source, "gi"))]
    .map((m) => ({ text: m[0].trim(), value: Number(m[0].replace(/[^\d.]/g, "")) }))
    .filter((p) => p.value > 0);
  const price = prices.length ? prices.reduce((a, b) => (b.value < a.value ? b : a)).text : null;
  const metaDescription =
    findTags(html, "meta").find((t) => (t.attrs.name || "").toLowerCase() === "description")?.attrs.content;
  const metaDescriptionText = metaDescription ? stripTags(metaDescription) || null : null;
  return {
    metaDescription: metaDescriptionText,
    siteType,
    proofSection,
    hasFaq: pages.faq,
    hasDemoVideo,
    hasGuarantee: /(money[- ]back|refund|guarantee|no questions asked)/i.test(bodyText),
    hasUrgency: /(price (rises|increases|goes up)|limited (time|seats|spots|offer|stock)|ends (in|soon|tonight)|only \d+ (left|spots|seats)|countdown|offer ends|hurry|today only|last chance)/i.test(bodyText + " " + html.slice(0, 50000)),
    hasPaymentBadges: PAYMENT_RE.test(html),
    price,
    heroHeadline,
    heroSubheadline,
    headings,
    ctas,
    testimonials: extractTestimonials(vis),
    trustSignals: extractTrustSignals(bodyText),
    pages,
    hasOffer: /\b(free (consultation|quote|estimate|trial|demo|delivery|inspection|site visit)|\d+% off|discount|offer|limited time|special price)\b/i.test(bodyText),
    hasLeadMagnet: /\b(download|free guide|e-?book|checklist|newsletter|subscribe)\b/i.test(bodyText),
  };
}

function checkStatus(categories: AuditCategory[], id: string): "pass" | "warn" | "fail" | null {
  for (const c of categories) {
    const k = c.checks.find((x) => x.id === id);
    if (k) return k.status === "info" ? null : k.status;
  }
  return null;
}

export function buildFunnel(content: SiteContent, categories: AuditCategory[]): FunnelStage[] {
  const fromCheck = (id: string, label: string, ok: string, bad: string): FunnelItem => {
    const s = checkStatus(categories, id);
    return { label, status: s === "pass" ? "yes" : s === "warn" ? "partial" : "no", note: s === "pass" ? ok : bad };
  };
  const item = (label: string, cond: boolean | "partial", ok: string, bad: string): FunnelItem => ({
    label,
    status: cond === "partial" ? "partial" : cond ? "yes" : "no",
    note: cond === true ? ok : bad,
  });

  const hWords = content.heroHeadline?.split(/\s+/).length ?? 0;
  const headlineState: boolean | "partial" = !content.heroHeadline ? false : hWords >= 3 && hWords <= 14 ? true : "partial";

  const tof: FunnelItem[] = [
    fromCheck("indexable", "Visible on Google", "Search engines can index the page.", "The page is hidden from Google."),
    fromCheck("title", "Search result title", "A clear title shows on Google.", "The Google result title is missing or weak."),
    fromCheck("meta-description", "Search result description", "Google shows a written description.", "Google has to guess a snippet."),
    fromCheck("structured-data", "Rich results (schema)", "Eligible for stars, hours and address in Google.", "No schema — plain, easy-to-skip listing."),
    fromCheck("social-preview", "Shareable on WhatsApp & social", "Shared links show a proper preview.", "Shared links show no image or title."),
    item("Hook headline", headlineState, "The first screen has a clear headline.", content.heroHeadline ? "The headline is too vague or too long to hook a visitor." : "There's no headline hooking visitors on the first screen."),
    item("Content that attracts traffic", content.pages.blog, "Has a blog / resources section.", "No blog or guides to attract new visitors from Google."),
  ];

  const testimonialsState: boolean | "partial" =
    content.testimonials.length >= 2 || (content.proofSection && content.testimonials.length >= 1)
      ? true
      : content.testimonials.length === 1 || content.proofSection || checkStatus(categories, "social-proof") === "pass"
        ? "partial"
        : false;
  const testimonialsNote = content.testimonials.length
    ? `${content.testimonials.length} written testimonials found on the page.`
    : content.proofSection
      ? `A results section ("${content.proofSection}") exists, but there are no written, named testimonials to read.`
      : "";
  const store = content.siteType === "store";

  const mofStore: FunnelItem[] = [
    item("What you get is clear", content.headings.length >= 4 || content.pages.services, "The page explains the offer section by section.", "It's unclear what exactly the buyer gets."),
    item("Demo / walkthrough video", content.hasDemoVideo, "A video shows the product in action.", "No demo video — buyers can't see what they're paying for."),
    item("Testimonials & results", testimonialsState, testimonialsNote, "No testimonials or results — nothing proves it works."),
    item("Trust signals", content.trustSignals.length >= 2 ? true : content.trustSignals.length === 1 ? "partial" : false, `Shows: ${content.trustSignals.slice(0, 3).join(", ")}.`, "No buyer counts, ratings or other trust numbers."),
    item("Answers to objections (FAQ)", content.hasFaq, "An FAQ handles buyers' doubts.", "No FAQ — doubts go unanswered and buyers hesitate."),
    item("Who is behind it", content.pages.about, "Buyers can see who's behind the product.", "No about / creator section — buyers don't know who they're trusting."),
  ];

  const mof: FunnelItem[] = store ? mofStore : [
    item("Clear services / offering", content.pages.services, "Services are easy to find.", "Visitors can't easily see what's offered."),
    item("About the business", content.pages.about, "An about/story section builds familiarity.", "Nothing tells visitors who is behind the business."),
    item("Testimonials & reviews", testimonialsState, testimonialsNote || "Only minimal social proof.", "No testimonials or reviews — nothing proves others trust this business."),
    item("Trust signals", content.trustSignals.length >= 2 ? true : content.trustSignals.length === 1 ? "partial" : false, `Shows: ${content.trustSignals.slice(0, 3).join(", ")}.`, "No numbers, years in business, ratings or certifications shown."),
    item("Proof of work", content.pages.caseStudies || content.pages.gallery, "Portfolio / case studies / gallery present.", "No case studies, portfolio or gallery to show results."),
    item("Answers to objections (FAQ)", content.pages.faq, "An FAQ handles common doubts.", "No FAQ — doubts go unanswered and visitors hesitate."),
    item("Pricing transparency", content.pages.pricing, "Pricing or packages are visible.", "No pricing guidance — many visitors leave rather than ask."),
  ];

  const bofStore: FunnelItem[] = [
    item("Buy button", content.ctas.length >= 1, `Buy button: "${content.ctas[0] ?? ""}", repeated down the page.`, "No clear buy button."),
    item("Price shown", !!content.price, `Price is visible (${content.price}).`, "No price shown — buyers leave rather than ask."),
    item("Payment options shown", content.hasPaymentBadges, "UPI / card logos reassure buyers at checkout.", "No payment badges near the buy button."),
    item("Guarantee / risk reversal", content.hasGuarantee, "A guarantee removes the risk of buying.", "No guarantee — the buyer carries all the risk."),
    item("Urgency or offer", content.hasUrgency || content.hasOffer, "A deadline or offer gives a reason to buy today.", "No reason to buy now rather than later."),
    fromCheck("whatsapp", "WhatsApp support", "Buyers can ask a quick question on WhatsApp.", "No WhatsApp — last-minute doubts go unanswered."),
    fromCheck("analytics", "Tracking & retargeting", "Pixel installed to retarget visitors who didn't buy.", "No tracking — visitors who leave can't be retargeted."),
  ];

  const bof: FunnelItem[] = store ? bofStore : [
    item("Clear call-to-action", content.ctas.length >= 2 ? true : content.ctas.length === 1 ? "partial" : false, `CTAs: ${content.ctas.slice(0, 3).map((c) => `"${c}"`).join(", ")}.`, content.ctas.length ? "Only one weak call-to-action." : "No button telling visitors what to do next."),
    fromCheck("tap-to-call", "Tap-to-call", "Phone number is one tap away.", "Mobile visitors can't call in one tap."),
    fromCheck("whatsapp", "WhatsApp chat", "Visitors can message on WhatsApp.", "No WhatsApp button — the channel Indian customers prefer."),
    fromCheck("contact-form", "Enquiry / booking form", "Visitors can leave their details.", "No form — after-hours visitors are lost."),
    item("Online booking", content.pages.booking, "Visitors can book directly.", "No way to book an appointment or slot online."),
    item("Offer or reason to act now", content.hasOffer, "An offer gives visitors a reason to act today.", "No offer (free consultation, quote, discount) to prompt action."),
    fromCheck("analytics", "Tracking & retargeting", "Analytics/pixel installed to measure and retarget.", "No tracking — lost visitors can't be retargeted with ads."),
  ];

  const score = (items: FunnelItem[]) =>
    Math.round((items.reduce((s, i) => s + (i.status === "yes" ? 1 : i.status === "partial" ? 0.5 : 0), 0) / items.length) * 100);

  return [
    { id: "tof", name: "Top of funnel", goal: "Get found & grab attention", score: score(tof), items: tof },
    { id: "mof", name: "Middle of funnel", goal: "Build interest & trust", score: score(mof), items: mof },
    { id: "bof", name: "Bottom of funnel", goal: store ? "Turn visitors into buyers" : "Turn visitors into enquiries", score: score(bof), items: bof },
  ];
}
