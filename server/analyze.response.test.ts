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

const contactPage: CollectedPage = {
  requestedUrl: "https://example.com/contact",
  finalUrl: "https://example.com/contact",
  status: 200,
  headers: {},
  html: "<html><head><title>Contact Example</title></head><body><h1>Contact us</h1><a href='mailto:hello@acme.test'>Email us</a><a href='tel:+92-42-111-222-333'>Call us</a></body></html>",
  elapsedMs: 80,
};

vi.mock("./lib/collectors/website", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/collectors/website")>();
  return { ...actual, fetchPublicHtml: vi.fn(), extractLinks: vi.fn(() => []), selectKeyPages: vi.fn(() => []) };
});

vi.mock("./lib/gemini", () => ({ enrichWithGemini: async (result: unknown) => result }));
vi.mock("./lib/googlePublicInformation", () => ({
  searchGooglePublicInformation: vi.fn(async () => ({
    provider: "GOOGLE_SEARCH",
    status: "AVAILABLE",
    statusMessage: "Cited public findings available.",
    summary: "The protected domain has a cited public presence.",
    citations: [{ id: "source-1", title: "Public source", url: "https://source.example/domain" }],
    citationSupports: [{ startIndex: 0, endIndex: 10, citationIds: ["source-1"] }],
  })),
  unavailableGooglePublicInformation: vi.fn(),
  attachPublicSearchDetails: vi.fn((information: any, business: any, extras: any = {}) => ({ ...information, searchQuery: `site:${business.domain} ${business.name}`, searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`site:${business.domain} ${business.name}`)}`, ...extras })),
}));

import { extractLinks, fetchPublicHtml, selectKeyPages } from "./lib/collectors/website";
import { analyzeWebsite, withinCollectionDeadline } from "./lib/analyze";
import { CollectionError } from "./lib/collectors/website";

describe("DBTI analysis response integrity", () => {
  beforeEach(() => {
    vi.mocked(fetchPublicHtml).mockReset();
    vi.mocked(fetchPublicHtml).mockResolvedValue(homepage);
    vi.mocked(extractLinks).mockReturnValue([]);
    vi.mocked(selectKeyPages).mockReturnValue([]);
  });

  it("returns every required score, factor, status, and grade field from deterministic evidence", async () => {
    const result = await analyzeWebsite("example.com");
    expect(result).toMatchObject({ dbtiScore: expect.any(Number), grade: expect.stringMatching(/^(A\+|A|B|C|D|F)$/), trustStatus: expect.any(String), scanTimestamp: expect.any(String) });
    expect(result.factors).toHaveLength(10);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.every((item) => ["VERIFIED_PASS", "VERIFIED_FAIL", "PARTIAL", "UNVERIFIED", "NOT_APPLICABLE"].includes(item.status))).toBe(true);
    expect(result.publicInformation.domain).toBe("example.com");
  });

  it("returns cited public-search findings without a score when the homepage refuses DBTI collection", async () => {
    vi.mocked(fetchPublicHtml).mockRejectedValueOnce(new CollectionError("ACCESS_DENIED", "The website refused automated access from the DBTI server during this scan (HTTP 403)."));

    const result = await analyzeWebsite("protected.example");

    expect(result.scanMode).toBe("PUBLIC_SEARCH_ONLY");
    expect(result.dbtiScore).toBeNull();
    expect(result.grade).toBe("UNAVAILABLE");
    expect(result.factors).toHaveLength(0);
    expect(result.googlePublicInformation.status).toBe("AVAILABLE");
    expect(result.googlePublicInformation.citations[0]?.url).toBe("https://source.example/domain");
    expect(result.explanation).toMatch(/no deterministic 0–1000 score was calculated/i);
  });

  it("analyzes pasted visible evidence without claiming server collection", async () => {
    const result = await analyzeWebsite("https://protected.example", "Protected Example is a public business providing products and customer support. Contact us at hello@protected.example or call +1 555 010 1234. This visible page text was copied by the user from the site in a normal browser.");
    expect(result.scanMode).toBe("ASSISTED_EVIDENCE");
    expect(result.dbtiScore).toEqual(expect.any(Number));
    expect(result.userProvidedEvidence).toMatchObject({ sourceUrl: "https://protected.example/", characterCount: expect.any(Number) });
    expect(result.evidence.every((item) => new URL(item.source).hostname === "protected.example")).toBe(true);
    expect(fetchPublicHtml).not.toHaveBeenCalled();
  });

  it("rejects a never-settling collection operation at the configured deadline", async () => {
    await expect(withinCollectionDeadline(new Promise<never>(() => undefined), 5)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("exposes explicit email and telephone contact evidence found on a collected public contact page", async () => {
    vi.mocked(extractLinks).mockReturnValue(["https://example.com/contact"]);
    vi.mocked(selectKeyPages).mockReturnValue(["https://example.com/contact"]);
    vi.mocked(fetchPublicHtml).mockResolvedValueOnce(homepage).mockResolvedValueOnce(contactPage);

    const result = await analyzeWebsite("example.com");

    expect(result.publicInformation.contactEmail).toBe("hello@acme.test");
    expect(result.publicInformation.contactPhone).toBe("+92-42-111-222-333");
    expect(result.evidence.find((item) => item.metric === "Public contact information")).toMatchObject({ status: "VERIFIED_PASS", source: "https://example.com/contact" });
  });
});
