import type { Business, GooglePublicInformation } from "../../shared/dbti";

const PUBLIC_SEARCH_TIMEOUT_MS = 12_000;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_SEARCH_RESULTS = 6;
const SEARCH_RESULT_TITLE_LENGTH = 240;
const SEARCH_RESULT_SNIPPET_LENGTH = 420;

export type PublicSearchDetails = { query: string; searchUrl: string };

export function buildPublicSearchDetails(business: Business): PublicSearchDetails {
  const host = new URL(business.website).hostname.replace(/^www\./, "");
  const query = `site:${host} ${business.name}`;
  return { query, searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}` };
}

function publicHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function attachPublicSearchDetails(
  information: GooglePublicInformation,
  business: Business,
  extras: Pick<GooglePublicInformation, "screenshotDataUrl" | "screenshotSubmittedAt" | "screenshotSource"> = {},
): GooglePublicInformation {
  const details = buildPublicSearchDetails(business);
  return { ...information, ...details, ...extras };
}

export function unavailableGooglePublicInformation(
  status: Exclude<GooglePublicInformation["status"], "AVAILABLE">,
  statusMessage: string,
): GooglePublicInformation {
  return {
    provider: "PUBLIC_WEB_SEARCH",
    status,
    statusMessage,
    citations: [],
    citationSupports: [],
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/\s+/g, " ")
    .trim();
}

function searchResultUrl(value: string): string | undefined {
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value, "https://duckduckgo.com");
    const redirected = url.searchParams.get("uddg");
    return publicHttpUrl(redirected ? new URL(redirected).toString() : url.toString());
  } catch {
    return undefined;
  }
}

function isRequestedHost(url: string, requestedHost: string): boolean {
  try {
    const resultHost = new URL(url).hostname.replace(/^www\./, "");
    return resultHost === requestedHost || resultHost.endsWith(`.${requestedHost}`);
  } catch {
    return false;
  }
}

function availablePublicInformation(
  results: Array<{ title: string; url: string; snippet: string }>,
  statusMessage: string,
): GooglePublicInformation {
  const limitedResults = results.slice(0, MAX_SEARCH_RESULTS);
  const citations = limitedResults.map((item, index) => ({ id: `public-search-source-${index + 1}`, title: item.title, url: item.url }));
  const summary = limitedResults.map((item, index) => `${item.title} [${index + 1}]: ${item.snippet}`).join(" ").slice(0, MAX_SUMMARY_LENGTH);
  return {
    provider: "PUBLIC_WEB_SEARCH",
    status: "AVAILABLE",
    statusMessage,
    summary,
    citations,
    citationSupports: limitedResults.map((_, index) => ({ startIndex: 0, endIndex: summary.length, citationIds: [citations[index].id] })),
  };
}

export function parseFreePublicSearchResults(html: string, requestedHost: string): GooglePublicInformation {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const resultPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) && results.length < MAX_SEARCH_RESULTS) {
    const url = searchResultUrl(match[1]);
    const title = decodeHtml(match[2]).slice(0, SEARCH_RESULT_TITLE_LENGTH);
    const snippet = decodeHtml(match[3]).slice(0, SEARCH_RESULT_SNIPPET_LENGTH);
    if (!url || !title || !snippet || !isRequestedHost(url, requestedHost)) continue;
    results.push({ title, url, snippet });
  }

  if (results.length === 0) {
    return unavailableGooglePublicInformation("NO_GROUNDED_OUTPUT", "The free public-search adapter returned no attributable results for this domain.");
  }

  return availablePublicInformation(
    results,
    "Free public-search findings are shown as a non-scoring supplement and are limited to attributable results from the submitted domain.",
  );
}

function xmlTagValue(item: string, tag: string): string | undefined {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : undefined;
}

export function parseBingRssPublicSearchResults(xml: string, requestedHost: string): GooglePublicInformation {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const item of items) {
    if (results.length >= MAX_SEARCH_RESULTS) break;
    const title = xmlTagValue(item, "title")?.slice(0, SEARCH_RESULT_TITLE_LENGTH);
    const url = publicHttpUrl(xmlTagValue(item, "link"));
    const snippet = xmlTagValue(item, "description")?.slice(0, SEARCH_RESULT_SNIPPET_LENGTH);
    if (!title || !url || !snippet || !isRequestedHost(url, requestedHost)) continue;
    results.push({ title, url, snippet });
  }

  if (results.length === 0) {
    return unavailableGooglePublicInformation("NO_GROUNDED_OUTPUT", "The keyless public-web fallbacks returned no attributable results for this domain.");
  }

  return availablePublicInformation(
    results,
    "Keyless public-web findings are shown as a non-scoring supplement with citations limited to attributable results from the submitted domain.",
  );
}

async function fetchText(url: string, accept: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: accept, "User-Agent": "DBTI-public-evidence/1.0" },
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchGooglePublicInformation(business: Business): Promise<GooglePublicInformation> {
  let requestedHost: string;
  try {
    requestedHost = new URL(business.website).hostname.replace(/^www\./, "");
  } catch {
    return unavailableGooglePublicInformation("UNAVAILABLE", "Public search could not validate the submitted website domain.");
  }

  const { query } = buildPublicSearchDetails(business);
  let duckDuckGoResult: GooglePublicInformation | undefined;
  try {
    const response = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, "text/html");
    if (response.ok) duckDuckGoResult = parseFreePublicSearchResults(response.text, requestedHost);
  } catch {
    duckDuckGoResult = undefined;
  }
  if (duckDuckGoResult?.status === "AVAILABLE") return attachPublicSearchDetails(duckDuckGoResult, business);

  try {
    const response = await fetchText(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, "application/rss+xml, application/xml, text/xml");
    if (response.ok) {
      const bingResult = parseBingRssPublicSearchResults(response.text, requestedHost);
      if (bingResult.status === "AVAILABLE") return attachPublicSearchDetails(bingResult, business);
    }
  } catch {
    // Preserve the truthful unavailable response below when both free sources fail.
  }

  const statusMessage = duckDuckGoResult?.status === "NO_GROUNDED_OUTPUT"
    ? "The free public-search sources returned no attributable results for this domain."
    : "Free public search could not be reached during this scan.";
  return attachPublicSearchDetails(unavailableGooglePublicInformation("UNAVAILABLE", statusMessage), business);
}
