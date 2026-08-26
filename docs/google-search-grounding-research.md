# Google Public-Information Research Notes

## Decision

DBTI will use **Gemini Google Search grounding** only as a server-side, bounded public-information supplement. It will remain separate from first-party website evidence and will not affect the deterministic DBTI numerical score.

## Evidence and display rules

Google's `generateContent` grounding guide documents a `google_search` tool request and a response `groundingMetadata` object containing search queries, source chunks, and citation supports. DBTI should display only the grounded narrative together with the returned source titles and URLs; it must never present uncited narrative as verified evidence.

The Gemini API additional terms say Grounded Results and Search Suggestions may be displayed only to the end user who submitted the prompt, prohibit caching, indexing, scraping, or learning from Grounded Results, Search Suggestions, and Links, and require associated Search Suggestions when Grounded Results are shown. DBTI therefore must keep this data in the in-memory scan response only, avoid persistence and downstream crawling, and render the returned search-entry-point content together with the summary when provided.

## Scope limits

Each DBTI scan should make one narrowly framed, identity-aware public-information request. The prompt must ask for a concise, neutral, source-cited summary of business identity, public-facing reputation signals, and material website-related facts, exclude unsupported allegations and sensitive personal data, and return no numerical score. A missing key, quota exhaustion, safety block, absent citations, or malformed grounding metadata must result in an explicit unavailable/ungrounded status with no effect on first-party evidence or scoring.

## Official references

1. Google AI for Developers, “Grounding with Google Search — generateContent API,” https://ai.google.dev/gemini-api/docs/generate-content/google-search
2. Google AI for Developers, “Gemini API Additional Terms of Service,” https://ai.google.dev/gemini-api/terms
3. Google for Developers, “Custom Search JSON API overview,” https://developers.google.com/custom-search/v1/overview

## Rationale

Google's Custom Search JSON API is closed to new customers, so it is not suitable as DBTI's new integration route. Gemini Google Search grounding supports the project's existing Gemini model family, returns source-linked support metadata, and can be isolated as a non-scoring supplement.

## Validation record

On 2026-08-26, a live DBTI scan of `https://example.com` returned the deterministic score (644) and the separately rendered Google public-information card. The available server-side Gemini quota returned HTTP 429, so the card accurately displayed `QUOTA_EXCEEDED` and retained no grounded summary or citations. This confirms that provider unavailability does not block website analysis or modify the score.

## Free protected-site recovery

DBTI does not require paid Google Custom Search credentials. When a website returns HTTP 403 to DBTI's server, the supported free recovery is user-assisted evidence: the user opens the public page in a normal browser, copies visible page text, and submits it with the page URL. DBTI validates the URL and bounds the pasted content before running deterministic analysis. The result is labeled `ASSISTED_EVIDENCE`; it does not claim DBTI fetched the page, and it does not bypass CAPTCHAs, authentication, robots controls, rate limits, or anti-bot protections.
