import { afterEach, describe, expect, it, vi } from "vitest";
import type { DBTIResult } from "../shared/dbti";
import { answerWithGemini, NO_DATA_RESPONSE } from "./lib/gemini";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function scoreScan(): DBTIResult {
  const evidence = [{
    id: "performance-response-time",
    factor: "performance" as const,
    metric: "Homepage response time",
    value: 2917,
    status: "VERIFIED_FAIL" as const,
    source: "https://example.com",
    observedAt: "2026-08-25T00:00:00.000Z",
    description: "Homepage response completed in 2917 ms during this scan.",
  }];
  return {
    business: { name: "Example", website: "https://example.com", domain: "example.com" },
    classification: { industry: "Unable to verify", subcategory: "Unable to verify", confidence: 0, evidence: [], provider: "deterministic" },
    publicInformation: { website: "https://example.com", domain: "example.com", socialLinks: [], policies: [], verificationSignals: [] },
    factors: [{ key: "performance", name: "Performance", score: 38, weight: 10, weightedContribution: 3.8, status: "VERIFIED_FAIL", coverage: 1, keyFinding: "Homepage response time was high in this scan.", metrics: evidence }],
    dbtiScore: 480,
    grade: "D",
    trustStatus: "Needs attention",
    strengths: [],
    weaknesses: [],
    evidence,
    recommendations: [],
    explanation: "Deterministic explanation.",
    scanTimestamp: "2026-08-25T00:00:00.000Z",
    aiAvailable: true,
    aiStatus: "AI_VALIDATED",
    aiStatusMessage: "Gemini was available during scan enrichment.",
  };
}

describe("DBTI Assistant grounded fallback", () => {
  it("explains a low score from deterministic verified scan evidence when Gemini cannot answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Gemini unavailable for test"))));
    const answer = await answerWithGemini("Why is my score low?", scoreScan());
    expect(answer).toContain("480/1000");
    expect(answer).toContain("Performance (38/100)");
    expect(answer).toContain("verified or partial evidence");
  });

  it("retains the exact insufficient-evidence phrase for scans with no verified evidence", async () => {
    const scan = scoreScan();
    scan.evidence = [{ ...scan.evidence[0], status: "UNVERIFIED" }];
    scan.factors[0].metrics = scan.evidence;
    await expect(answerWithGemini("Why is my score low?", scan)).resolves.toBe(NO_DATA_RESPONSE);
  });
});
