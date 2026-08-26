import type { Business, GooglePublicCitation, GooglePublicCitationSupport, GooglePublicInformation } from "../../shared/dbti";

const GEMINI_MODEL = "gemini-3.6-flash";
const GOOGLE_SEARCH_TIMEOUT_MS = 15_000;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_SEARCH_SUGGESTION_HTML_LENGTH = 32_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
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

export function unavailableGooglePublicInformation(
  status: Exclude<GooglePublicInformation["status"], "AVAILABLE">,
  statusMessage: string,
): GooglePublicInformation {
  return {
    provider: "GOOGLE_SEARCH",
    status,
    statusMessage,
    citations: [],
    citationSupports: [],
  };
}

function textFromCandidate(candidate: JsonRecord): string | undefined {
  const content = isRecord(candidate.content) ? candidate.content : undefined;
  const firstPart = content ? recordArray(content.parts)[0] : undefined;
  const text = firstPart?.text;
  return typeof text === "string" && text.trim() && text.length <= MAX_SUMMARY_LENGTH ? text : undefined;
}

function parseGooglePublicInformation(body: unknown): GooglePublicInformation {
  const candidate = isRecord(body) ? recordArray(body.candidates)[0] : undefined;
  const summary = candidate ? textFromCandidate(candidate) : undefined;
  const grounding = candidate && isRecord(candidate.groundingMetadata) ? candidate.groundingMetadata : undefined;
  if (!summary || !grounding) {
    return unavailableGooglePublicInformation("NO_GROUNDED_OUTPUT", "Google Search did not return a source-grounded public-information summary for this scan.");
  }

  const chunks = recordArray(grounding.groundingChunks);
  const citations: GooglePublicCitation[] = [];
  const citationIdByChunkIndex = new Map<number, string>();
  for (const [index, chunk] of chunks.entries()) {
    const web = isRecord(chunk.web) ? chunk.web : undefined;
    const url = publicHttpUrl(web?.uri);
    const title = typeof web?.title === "string" && web.title.trim() ? web.title.trim().slice(0, 240) : undefined;
    if (!url || !title) continue;
    const id = `google-source-${citations.length + 1}`;
    citations.push({ id, title, url });
    citationIdByChunkIndex.set(index, id);
  }

  const citationSupports: GooglePublicCitationSupport[] = recordArray(grounding.groundingSupports).flatMap((support) => {
    const segment = isRecord(support.segment) ? support.segment : undefined;
    const startIndex = segment?.startIndex;
    const endIndex = segment?.endIndex;
    const indices = Array.isArray(support.groundingChunkIndices) ? support.groundingChunkIndices : [];
    const citationIds = indices
      .filter((index): index is number => typeof index === "number" && Number.isInteger(index))
      .map((index) => citationIdByChunkIndex.get(index))
      .filter((id): id is string => Boolean(id));
    if (typeof startIndex !== "number" || typeof endIndex !== "number" || startIndex < 0 || endIndex <= startIndex || endIndex > summary.length || citationIds.length === 0) return [];
    return [{ startIndex, endIndex, citationIds: [...new Set(citationIds)] }];
  });

  const renderedContent = isRecord(grounding.searchEntryPoint) ? grounding.searchEntryPoint.renderedContent : undefined;
  const searchSuggestionHtml = typeof renderedContent === "string" && renderedContent.trim() && renderedContent.length <= MAX_SEARCH_SUGGESTION_HTML_LENGTH
    ? renderedContent
    : undefined;
  if (citations.length === 0 || citationSupports.length === 0) {
    return unavailableGooglePublicInformation("NO_GROUNDED_OUTPUT", "Google Search did not return usable cited public-information findings for this scan.");
  }

  return {
    provider: "GOOGLE_SEARCH",
    status: "AVAILABLE",
    statusMessage: "Google Search-grounded public information is shown separately and does not change the deterministic DBTI score.",
    summary,
    citations,
    citationSupports,
    searchSuggestionHtml,
  };
}

export async function searchGooglePublicInformation(business: Business): Promise<GooglePublicInformation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return unavailableGooglePublicInformation("NOT_CONFIGURED", "Google public-information search is unavailable until the server-side Gemini API is configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_SEARCH_TIMEOUT_MS);
  const prompt = [
    "Produce a concise, neutral Google Search-grounded public-information response for one DBTI scan.",
    `The end user submitted this business website: ${business.website}`,
    `The observed business name is: ${business.name}`,
    "Use public web sources only to distinguish this business from similarly named entities and summarize material, factual information related to its public digital presence.",
    "Do not score, rank, recommend, speculate, repeat unverified claims, include sensitive personal data, or state allegations. Do not make legal, medical, financial, or safety claims. Keep the response below 350 words and rely only on claims that Google Search can cite.",
    "This response is a non-scoring supplement; the DBTI numerical score remains based only on the website evidence collected in the scan.",
  ].join("\n");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!response.ok) {
      if (response.status === 429) return unavailableGooglePublicInformation("QUOTA_EXCEEDED", "Google public-information search is temporarily unavailable because the server-side Gemini quota is exhausted.");
      return unavailableGooglePublicInformation("UNAVAILABLE", `Google public-information search could not be completed (HTTP ${response.status}).`);
    }
    return parseGooglePublicInformation(await response.json());
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Google public-information search did not complete before the scan deadline."
      : "Google public-information search could not be reached during this scan.";
    return unavailableGooglePublicInformation("UNAVAILABLE", message);
  } finally {
    clearTimeout(timeout);
  }
}
