import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectedPage } from "./lib/collectors/website";

const homepage: CollectedPage = {
  requestedUrl: "https://example.com",
  finalUrl: "https://example.com/",
  status: 200,
  headers: { "strict-transport-security": "max-age=1", "content-security-policy": "default-src 'self'" },
  html: "<html><head><title>Example Co</title><meta name='description' content='Example public business'></head><body><h1>Example Co</h1><p>Example public website content that provides a clear business description for deterministic analysis.</p></body></html>",
  elapsedMs: 120,
};

vi.mock("./lib/collectors/website", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/collectors/website")>();
  return { ...actual, fetchPublicHtml: vi.fn(), extractLinks: vi.fn(() => []), selectKeyPages: vi.fn(() => []) };
});

vi.mock("./lib/gemini", () => ({ enrichWithGemini: async (result: unknown) => result }));

import { fetchPublicHtml } from "./lib/collectors/website";
import { analyzeWebsite, withinCollectionDeadline } from "./lib/analyze";

describe("DBTI analysis response integrity", () => {
  beforeEach(() => {
    vi.mocked(fetchPublicHtml).mockResolvedValue(homepage);
  });

  it("returns every required score, factor, status, and grade field from deterministic evidence", async () => {
    const result = await analyzeWebsite("example.com");
    expect(result).toMatchObject({ dbtiScore: expect.any(Number), grade: expect.stringMatching(/^(A\+|A|B|C|D|F)$/), trustStatus: expect.any(String), scanTimestamp: expect.any(String) });
    expect(result.factors).toHaveLength(10);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.every((item) => ["VERIFIED_PASS", "VERIFIED_FAIL", "PARTIAL", "UNVERIFIED", "NOT_APPLICABLE"].includes(item.status))).toBe(true);
    expect(result.publicInformation.domain).toBe("example.com");
  });

  it("rejects a never-settling collection operation at the configured deadline", async () => {
    await expect(withinCollectionDeadline(new Promise<never>(() => undefined), 5)).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
