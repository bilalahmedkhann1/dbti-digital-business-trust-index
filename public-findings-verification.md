# Public-Web Findings Verification

A live scan of `https://www.wikipedia.org/` using the extracted business name `Wikipedia` was run against the DBTI public-information adapter.

| Check | Result |
| --- | --- |
| Provider | `PUBLIC_WEB_SEARCH` |
| Status | `AVAILABLE` |
| Query | `site:wikipedia.org Wikipedia` |
| Google search URL | Generated and attached: `https://www.google.com/search?q=site%3Awikipedia.org%20Wikipedia` |
| Attributable citations | 6 same-domain Wikipedia results |
| Summary | Present and assembled from returned public snippets |
| Scoring boundary | Explicitly labeled as a non-scoring supplement |

The first free HTML endpoint returned a challenge response in the sandbox. DBTI now falls back to Bing RSS without bypassing the challenge or treating the blocked response as evidence. The fallback returned six attributable Wikipedia URLs, a summary, and citation supports. This confirms that public-web findings are working when a free source is reachable, while unavailable/no-grounded-output states remain truthful when all sources fail.

## Visual Refresh Verification

The DBTI homepage was visually checked at desktop and at a 390px mobile breakpoint after integrating the generated evidence-network illustration into the protocol card. The illustration is decorative and `aria-hidden`, sits behind the card copy, and uses the supplied red, maroon, cream, and noir visual language. The search control remains readable on the Cotton surface, and the mobile layout preserves the indexed Collect / Score / Explain rhythm without horizontal overflow. The development-only dark query preview was also checked; production defaults and persisted theme behavior remain unchanged.

## Results UI Visual Verification

The development-only results preview was inspected on desktop and mobile in both light and dark theme states. The public-findings panel showed the `PUBLIC_WEB_SEARCH` provider label, query metadata, citation list, summary text, and explicit non-scoring boundary without clipping. The score hero, charts, factor rows, recommendations, and assistant explanation remained readable in Noir mode. The narrow layout stacked the evidence and chart surfaces without horizontal overflow.
