# DBTI — Digital Business Trust Index

DBTI analyzes a public website through a bounded server-side collection pipeline, records evidence with a verification status, calculates a deterministic ten-factor score from 0 to 1000, and presents the result in an accessible dark interface. The result is not a financial, legal, security, or commercial certification; it is a point-in-time assessment of the public pages collected for a particular scan.

## Analysis contract

The primary HTTP endpoint is `POST /api/analyze` with a JSON body containing `{ "query": "https://example.com" }`. It returns a structured result with public information, factor scores, per-metric evidence, a composite DBTI score, the exact grade scale `A+`, `A`, `B`, `C`, `D`, `F`, and evidence-linked Gemini interpretations when available.

| Boundary | Implementation |
|---|---|
| Public collection | Homepage plus up to four related About, Contact, Privacy, or Terms pages |
| Network safety | URL normalization, localhost and credential rejection, DNS public-address checks, redirect limits, DNS/fetch timeouts, response-size limits |
| Missing data | `VERIFIED_PASS`, `VERIFIED_FAIL`, `PARTIAL`, `UNVERIFIED`, and `NOT_APPLICABLE`; unverified data is never automatically assigned zero |
| Score | Ten weighted factors produce a deterministic score from 0–1000 |
| AI | Gemini is server-side only; classification, explanation, recommendations, and answers are discarded or fall back when they lack valid scan evidence |

## Gemini configuration

Set `GEMINI_API_KEY` through the project secrets interface. DBTI uses the configured key on the server only with the current Gemini Flash model. The browser never receives the key. A lightweight key-validation test is available in `server/gemini.secret.test.ts`.

If Gemini is unavailable or an answer cannot be grounded in verified evidence, deterministic scoring remains available. The assistant uses the exact response **“I don't have enough verified data”** when the supplied evidence cannot support an answer.

## Local validation

Run the following from the project root.

```bash
pnpm test
pnpm build
```

The unit suite covers deterministic scoring, grade boundaries, the missing-data rule, URL-safety validation, the grounded-assistant fallback phrase, and the Gemini credential check. A live Gemini generation probe remains in `server/gemini.generation.integration.ts` so normal unit tests do not depend on external model latency.

## Deployment

Create a project checkpoint and use the built-in Publish control to deploy. The application is designed for a request-bounded autoscaling runtime: it has no background workers and performs collection and AI interpretation within the individual analysis request. For reliable results, analyze only websites that are publicly reachable from the deployment environment.
