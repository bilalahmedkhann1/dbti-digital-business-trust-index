import type { Business, GooglePublicInformation } from "../../shared/dbti";

const PUBLIC_SEARCH_TIMEOUT_MS = 12_000;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_SEARCH_RESULTS = 6;
const SEARCH_RESULT_TITLE_LENGTH = 240;
const SEARCH_RESULT_SNIPPET_LENGTH = 420;

type JsonRecord = Record<string, unknown>;

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

export function parseFreePublicSearchResults(html: string, requestedHost: string): GooglePublicInformation {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const resultPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) && results.length < MAX_SEARCH_RESULTS) {
    const url = searchResultUrl(match[1]);
    const title = decodeHtml(match[2]).slice(0, SEARCH_RESULT_TITLE_LENGTH);
    const snippet = decodeHtml(match[3]).slice(0, SEARCH_RESULT_SNIPPET_LENGTH);
    if (!url || !title || !snippet) continue;
    try {
      const resultHost = new URL(url).hostname.replace(/^www\./, "");
      if (resultHost !== requestedHost && !resultHost.endsWith(`.${requestedHost}`)) continue;
    } catch {
      continue;
    }
    results.push({ title, url, snippet });
  }

  if (results.length === 0) {
    return unavailableGooglePublicInformation("NO_GROUNDED_OUTPUT", "The free public-search adapter returned no attributable results for this domain.");
  }

  const citations = results.map((item, index) => ({ id: `public-search-source-${index + 1}`, title: item.title, url: item.url }));
  const summary = results.map((item, index) => `${item.title} [${index + 1}]: ${item.snippet}`).join(" ").slice(0, MAX_SUMMARY_LENGTH);
  return {
    provider: "PUBLIC_WEB_SEARCH",
    status: "AVAILABLE",
    statusMessage: "Free public-search findings are shown as a non-scoring supplement and are limited to attributable results from the submitted domain.",
    summary,
    citations,
    citationSupports: results.map((_, index) => ({ startIndex: 0, endIndex: summary.length, citationIds: [citations[index].id] })),
  };
}

export async function searchGooglePublicInformation(business: Business): Promise<GooglePublicInformation> {
  let requestedHost: string;
  try {
    requestedHost = new URL(business.website).hostname.replace(/^www\./, "");
  } catch {
    return unavailableGooglePublicInformation("UNAVAILABLE", "Public search could not validate the submitted website domain.");
  }

  const query = `site:${requestedHost} ${business.name}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "text/html", "User-Agent": "DBTI-public-evidence/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) return unavailableGooglePublicInformation("UNAVAILABLE", `Free public search returned HTTP ${response.status}.`);
    return parseFreePublicSearchResults(await response.text(), requestedHost);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Free public search did not complete before the scan deadline."
      : "Free public search could not be reached during this scan.";
    return unavailableGooglePublicInformation("UNAVAILABLE", message);
  } finally {
    clearTimeout(timeout);
  }
}
