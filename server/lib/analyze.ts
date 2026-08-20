import { calculateDbtiScore, calculateFactorScores, scoreBand } from "../../lib/scoring";
import type { Business, ClassificationResult, DBTIResult, Evidence, FactorKey, MetricStatus, PublicInformation } from "../../shared/dbti";
import { CollectionError, extractLinks, fetchPublicHtml, normalizePublicUrl, selectKeyPages, type CollectedPage } from "./collectors/website";
import { enrichWithGemini } from "./gemini";

export class AnalysisInputError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com", "youtube.com", "tiktok.com"];
const COLLECTION_DEADLINE_MS = 10_000;
const now = () => new Date().toISOString();

export async function withinCollectionDeadline<T>(operation: Promise<T>, timeoutMs = COLLECTION_DEADLINE_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AnalysisInputError("TIMEOUT", "The public website collection did not complete in time.")), timeoutMs);
    });
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function stripHtml(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function attribute(html: string, selector: RegExp, attributeName: string): string | undefined {
  const match = selector.exec(html);
  if (!match) return undefined;
  const tag = match[0];
  const value = new RegExp(`\\b${attributeName}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
  return value?.trim();
}

function metaContent(html: string, key: string): string | undefined {
  const meta = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = meta.exec(html))) {
    const tag = match[0];
    const name = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim();
    if (name === key.toLowerCase() && content) return content;
  }
  return undefined;
}

function tagText(html: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(html);
  const value = match ? stripHtml(match[1]) : "";
  return value || undefined;
}

function findEmail(html: string): string | undefined {
  const email = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return email && !/(?:sentry|example|wixpress)\./i.test(email) ? email : undefined;
}

function findPhone(html: string): string | undefined {
  const candidate = html.match(/(?:\+?\d[\d\s()-]{7,}\d)/)?.[0]?.trim();
  const digits = candidate?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 && digits.length <= 15 ? candidate : undefined;
}

function socialProfileLinks(links: string[]): string[] {
  return links.filter((link) => {
    const host = new URL(link).hostname.toLowerCase();
    return SOCIAL_HOSTS.some((source) => host === source || host.endsWith(`.${source}`));
  });
}

function hasJsonLd(html: string): boolean {
  return /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/i.test(html);
}

function metric(
  factor: FactorKey,
  metricName: string,
  value: string | number | boolean | null,
  status: MetricStatus,
  source: string,
  description: string,
): Evidence {
  return {
    id: `${factor}-${metricName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    factor,
    metric: metricName,
    value,
    status,
    source,
    observedAt: now(),
    description,
  };
}

function statusWhen(passes: boolean): MetricStatus {
  return passes ? "VERIFIED_PASS" : "VERIFIED_FAIL";
}

function fallbackClassification(title: string, description: string, text: string): ClassificationResult {
  const source = `${title} ${description} ${text}`.toLowerCase();
  const categories = [
    { industry: "E-commerce", subcategory: "Online Retail", terms: ["shop", "cart", "product", "shipping"] },
    { industry: "Restaurant", subcategory: "Food Service", terms: ["menu", "restaurant", "reservation", "delivery"] },
    { industry: "Technology", subcategory: "Software & Services", terms: ["software", "platform", "api", "cloud"] },
    { industry: "Professional Services", subcategory: "Business Services", terms: ["consulting", "advisory", "law firm", "accounting"] },
  ];
  const match = categories.find((category) => category.terms.some((term) => source.includes(term)));
  return match
    ? { industry: match.industry, subcategory: match.subcategory, confidence: 35, evidence: ["Deterministic keyword classification from publicly collected page content."], provider: "deterministic" }
    : { industry: "Unable to verify", subcategory: "Unable to verify", confidence: 0, evidence: ["Insufficient public website content for a reliable classification."], provider: "deterministic" };
}

function getBusinessName(home: CollectedPage): string {
  const schemaName = /"(?:name|legalName)"\s*:\s*"([^"\\]{2,})"/i.exec(home.html)?.[1];
  const title = tagText(home.html, "title");
  return schemaName ?? title?.split(/[|—–-]/)[0]?.trim() ?? new URL(home.finalUrl).hostname;
}

function policyPage(name: string, pages: CollectedPage[]): CollectedPage | undefined {
  return pages.find((page) => new RegExp(name, "i").test(new URL(page.finalUrl).pathname));
}

function buildEvidence(home: CollectedPage, pages: CollectedPage[]): Evidence[] {
  const source = home.finalUrl;
  const title = tagText(home.html, "title");
  const description = metaContent(home.html, "description");
  const canonical = attribute(home.html, /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i, "href");
  const viewport = metaContent(home.html, "viewport");
  const visibleText = stripHtml(home.html);
  const headings = Array.from(home.html.matchAll(/<h[1-6]\b[^>]*>/gi)).length;
  const h1 = tagText(home.html, "h1");
  const links = extractLinks(home.html, home.finalUrl);
  const socialLinks = socialProfileLinks(links);
  const publicEmail = findEmail(visibleText);
  const publicPhone = findPhone(visibleText);
  const privacy = policyPage("privacy|cookie", pages);
  const terms = policyPage("terms|legal", pages);
  const contact = policyPage("contact", pages);
  const about = policyPage("about", pages);
  const headers = home.headers;
  const hsts = Boolean(headers["strict-transport-security"]);
  const csp = Boolean(headers["content-security-policy"]);
  const xFrame = Boolean(headers["x-frame-options"] || headers["content-security-policy"]?.includes("frame-ancestors"));
  const xContent = Boolean(headers["x-content-type-options"]);
  const referrer = Boolean(headers["referrer-policy"]);
  const dnsSource = `https://${new URL(home.finalUrl).hostname}`;

  return [
    metric("security", "HTTPS", new URL(home.finalUrl).protocol === "https:", statusWhen(new URL(home.finalUrl).protocol === "https:"), source, new URL(home.finalUrl).protocol === "https:" ? "HTTPS connection successfully established." : "The scanned page was served without HTTPS."),
    metric("security", "HSTS", hsts, statusWhen(hsts), source, hsts ? "Strict-Transport-Security header was observed." : "Strict-Transport-Security header was not observed."),
    metric("security", "Content Security Policy", csp, statusWhen(csp), source, csp ? "Content-Security-Policy header was observed." : "Content-Security-Policy header was not observed."),
    metric("security", "Frame protection", xFrame, statusWhen(xFrame), source, xFrame ? "A frame-embedding protection header was observed." : "No observable frame-embedding protection header was found."),
    metric("security", "MIME sniffing protection", xContent, statusWhen(xContent), source, xContent ? "X-Content-Type-Options header was observed." : "X-Content-Type-Options header was not observed."),
    metric("security", "Referrer policy", referrer, statusWhen(referrer), source, referrer ? "Referrer-Policy header was observed." : "Referrer-Policy header was not observed."),
    metric("seo", "Page title", Boolean(title), statusWhen(Boolean(title)), source, title ? `Homepage title found: ${title}.` : "No homepage title element was found."),
    metric("seo", "Meta description", Boolean(description), statusWhen(Boolean(description)), source, description ? "Homepage meta description was found." : "No homepage meta description was found."),
    metric("seo", "Canonical URL", Boolean(canonical), statusWhen(Boolean(canonical)), source, canonical ? "A canonical link was found." : "No canonical link was found."),
    metric("seo", "Primary heading", Boolean(h1), statusWhen(Boolean(h1)), source, h1 ? "A primary page heading was found." : "No primary page heading was found."),
    metric("seo", "Structured data", hasJsonLd(home.html), statusWhen(hasJsonLd(home.html)), source, hasJsonLd(home.html) ? "JSON-LD structured data was found." : "No JSON-LD structured data was found."),
    metric("seo", "Robots and sitemap", null, "UNVERIFIED", source, "Robots and sitemap files were not fetched in this bounded scan."),
    metric("performance", "Homepage response time", home.elapsedMs, home.elapsedMs < 1000 ? "VERIFIED_PASS" : home.elapsedMs < 2500 ? "PARTIAL" : "VERIFIED_FAIL", source, `Homepage response completed in ${home.elapsedMs} ms during this scan.`),
    metric("performance", "Homepage document size", new TextEncoder().encode(home.html).byteLength, new TextEncoder().encode(home.html).byteLength < 800_000 ? "VERIFIED_PASS" : "PARTIAL", source, `Homepage HTML document measured ${new TextEncoder().encode(home.html).byteLength} bytes.`),
    metric("performance", "Core Web Vitals", null, "UNVERIFIED", source, "Core Web Vitals require a browser-field or lab measurement and were not collected in this request."),
    metric("contentQuality", "Readable homepage content", visibleText.length, visibleText.length >= 300 ? "VERIFIED_PASS" : visibleText.length > 0 ? "PARTIAL" : "VERIFIED_FAIL", source, `The visible homepage text contains ${visibleText.length} characters.`),
    metric("contentQuality", "Heading structure", headings, headings >= 2 ? "VERIFIED_PASS" : headings === 1 ? "PARTIAL" : "VERIFIED_FAIL", source, `The homepage exposes ${headings} heading elements.`),
    metric("contentQuality", "Business description", Boolean(description), statusWhen(Boolean(description)), source, description ? "A public business description was found in the homepage metadata." : "No public business description was found in the homepage metadata."),
    metric("socialPresence", "Official social links", socialLinks.length, socialLinks.length > 0 ? "VERIFIED_PASS" : "UNVERIFIED", source, socialLinks.length > 0 ? `${socialLinks.length} social profile link(s) were found on the homepage.` : "No official social profile links were found on the homepage; this is not treated as a failure."),
    metric("socialPresence", "Public social activity", null, "UNVERIFIED", source, "Social activity and audience data were not collected from third-party platforms."),
    metric("legalCompliance", "Privacy information", Boolean(privacy), privacy ? "VERIFIED_PASS" : "UNVERIFIED", privacy?.finalUrl ?? source, privacy ? "A publicly accessible privacy or cookie page was collected." : "No publicly accessible privacy information was verified in this bounded scan."),
    metric("legalCompliance", "Terms information", Boolean(terms), terms ? "VERIFIED_PASS" : "UNVERIFIED", terms?.finalUrl ?? source, terms ? "A publicly accessible terms or legal page was collected." : "No publicly accessible terms information was verified in this bounded scan."),
    metric("legalCompliance", "Cookie mechanism", null, "UNVERIFIED", source, "Cookie consent behavior was not evaluated in this bounded server-side scan."),
    metric("mobile", "Viewport configuration", Boolean(viewport), statusWhen(Boolean(viewport)), source, viewport ? "A viewport meta tag was found." : "No viewport meta tag was found."),
    metric("mobile", "Mobile interaction audit", null, "UNVERIFIED", source, "Mobile interaction and horizontal overflow require a rendered browser audit and were not collected."),
    metric("reliability", "DNS resolution", true, "VERIFIED_PASS", dnsSource, "The website domain resolved during this scan."),
    metric("reliability", "Homepage availability", home.status, home.status >= 200 && home.status < 400 ? "VERIFIED_PASS" : "VERIFIED_FAIL", source, `The homepage returned HTTP ${home.status} during this scan.`),
    metric("reliability", "Historical uptime", null, "UNVERIFIED", source, "Historical uptime cannot be inferred from a single scan."),
    metric("transparency", "Public contact information", Boolean(publicEmail || publicPhone || contact), (publicEmail || publicPhone || contact) ? "VERIFIED_PASS" : "UNVERIFIED", contact?.finalUrl ?? source, (publicEmail || publicPhone || contact) ? "Visible public contact information or a contact page was found." : "No visible public contact information was verified in this bounded scan."),
    metric("transparency", "About information", Boolean(about), about ? "VERIFIED_PASS" : "UNVERIFIED", about?.finalUrl ?? source, about ? "A publicly accessible about page was collected." : "No publicly accessible about page was verified in this bounded scan."),
    metric("transparency", "Structured business identity", hasJsonLd(home.html), hasJsonLd(home.html) ? "VERIFIED_PASS" : "UNVERIFIED", source, hasJsonLd(home.html) ? "Structured data provides a public business identity signal." : "No structured business identity signal was verified."),
    metric("reputation", "Reliable public reputation data", null, "UNVERIFIED", source, "No reliable public reputation source was collected; this is not treated as low reputation."),
  ];
}

export async function analyzeWebsite(query: string): Promise<DBTIResult> {
  let requested: URL;
  try {
    requested = normalizePublicUrl(query);
  } catch (error) {
    if (error instanceof CollectionError) throw new AnalysisInputError(error.code, error.message);
    throw error;
  }

  let home: CollectedPage;
  try {
    home = await withinCollectionDeadline(fetchPublicHtml(requested));
  } catch (error) {
    if (error instanceof AnalysisInputError) throw error;
    if (error instanceof CollectionError) throw new AnalysisInputError(error.code, error.message);
    throw new AnalysisInputError("UNAVAILABLE", "The website could not be analyzed during this scan.");
  }

  const links = extractLinks(home.html, home.finalUrl);
  const keyPages = selectKeyPages(home.finalUrl, links);
  let collected: PromiseSettledResult<CollectedPage>[];
  try {
    collected = await withinCollectionDeadline(Promise.allSettled(keyPages.map((url) => fetchPublicHtml(url))));
  } catch (error) {
    if (error instanceof AnalysisInputError) throw error;
    throw new AnalysisInputError("UNAVAILABLE", "The supporting public pages could not be collected.");
  }
  const pages = collected.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  const evidence = buildEvidence(home, pages);
  const factors = calculateFactorScores(evidence);
  const dbtiScore = calculateDbtiScore(factors);
  const band = scoreBand(dbtiScore);
  const title = tagText(home.html, "title") ?? "";
  const description = metaContent(home.html, "description") ?? "";
  const name = getBusinessName(home);
  const domain = new URL(home.finalUrl).hostname;
  const visibleText = stripHtml(home.html);
  const socialLinks = socialProfileLinks(links);
  const publicEmail = findEmail(visibleText);
  const publicPhone = findPhone(visibleText);
  const info: PublicInformation = {
    website: home.finalUrl,
    domain,
    ...(description ? { description } : {}),
    ...(publicEmail ? { contactEmail: publicEmail } : {}),
    ...(publicPhone ? { contactPhone: publicPhone } : {}),
    socialLinks,
    policies: pages.filter((page) => /privacy|cookie|terms|legal/i.test(page.finalUrl)).map((page) => page.finalUrl),
    verificationSignals: evidence.filter((item) => item.status === "VERIFIED_PASS" && ["security", "reliability", "transparency"].includes(item.factor)).map((item) => item.metric),
  };
  const business: Business = { name, website: home.finalUrl, domain };
  const rankedStrong = [...factors].filter((factor) => factor.coverage > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const rankedWeak = [...factors].filter((factor) => factor.coverage > 0).sort((a, b) => a.score - b.score).slice(0, 3);
  const classification = fallbackClassification(title, description, stripHtml(home.html));
  const explanation = `${name} received ${dbtiScore}/1000 from the observed public evidence available during this scan. The score is deterministic: each factor only uses the collected metrics, and unavailable evidence is marked separately rather than automatically scored as zero.`;

  const deterministicResult: DBTIResult = {
    business,
    classification,
    publicInformation: info,
    factors,
    dbtiScore,
    grade: band.grade,
    trustStatus: band.trustStatus,
    strengths: rankedStrong,
    weaknesses: rankedWeak,
    evidence,
    recommendations: [],
    explanation,
    scanTimestamp: now(),
    aiAvailable: false,
  };
  return enrichWithGemini(deterministicResult);
}
