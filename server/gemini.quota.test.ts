import { afterEach, describe, expect, it, vi } from "vitest";
import type { DBTIResult } from "../shared/dbti";
import { enrichWithGemini } from "./lib/gemini";

function scanWithVerifiedFailure(): DBTIResult {
  const evidence = [{
    id: "security-frame-protection",
    factor: "security" as const,
    metric: "Frame protection",
    value: false,
    status: "VERIFIED_FAIL" as const,
    source: "https://example.com",
    observedAt: "2026-08-20T00:00:00.000Z",
    description: "No observable frame-embedding protection header was found.",
  }];
  return {
    business: { name: "Example", website: "https://example.com", domain: "example.com" },
    classification: { industry: "Unable to verify", subcategory: "Unable to verify", confidence: 0, evidence: [], provider: "deterministic" },
    publicInformation: { website: "https://example.com", domain: "example.com", socialLinks: [], policies: [], verificationSignals: [] },
    factors: [],
    dbtiScore: 500,
    grade: "D",
    trustStatus: "Needs attention",
    strengths: [],
    weaknesses: [],
    evidence,
    recommendations: [],
    explanation: "Deterministic explanation.",
    scanTimestamp: "2026-08-20T00:00:00.000Z",
    aiAvailable: false,
    aiStatus: "NOT_CONFIGURED",
    aiStatusMessage: "Pending AI enrichment.",
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini quota fallback", () => {
  it("identifies API quota exhaustion and retains only evidence-backed deterministic recommendations", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response('{"error":{"code":429}}', { status: 429 }))));

    const result = await enrichWithGemini(scanWithVerifiedFailure());

    expect(result).toMatchObject({ aiAvailable: false, aiStatus: "QUOTA_EXCEEDED" });
    expect(result.aiStatusMessage).toContain("quota");
    expect(result.recommendations).toEqual([expect.objectContaining({ title: "Review Frame protection", priority: "High" })]);
  });
});
