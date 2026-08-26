import { afterEach, describe, expect, it, vi } from "vitest";
import { searchGooglePublicInformation } from "./lib/googlePublicInformation";

const business = {
  name: "Example Company",
  website: "https://example.com/",
  domain: "example.com",
};

const originalApiKey = process.env.GEMINI_API_KEY;

function mockResponse(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;
});

describe("Google public-information search", () => {
  it("keeps source-cited Google findings distinct from website scoring data", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockResponse({
      candidates: [{
        content: { parts: [{ text: "Example Company has an official public website and listed customer support resources." }] },
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: "https://source.example/article", title: "Independent source" } },
            { web: { uri: "https://example.com/support", title: "Example support" } },
          ],
          groundingSupports: [
            { segment: { startIndex: 0, endIndex: 27 }, groundingChunkIndices: [0] },
            { segment: { startIndex: 28, endIndex: 76 }, groundingChunkIndices: [1] },
          ],
          searchEntryPoint: { renderedContent: '<a href="https://www.google.com/search?q=example">Search suggestions</a>' },
        },
      }],
    });

    const result = await searchGooglePublicInformation(business);

    expect(result.status).toBe("AVAILABLE");
    expect(result.provider).toBe("GOOGLE_SEARCH");
    expect(result.summary).toContain("Example Company");
    expect(result.citations).toEqual([
      { id: "google-source-1", title: "Independent source", url: "https://source.example/article" },
      { id: "google-source-2", title: "Example support", url: "https://example.com/support" },
    ]);
    expect(result.citationSupports).toHaveLength(2);
    expect(result.searchSuggestionHtml).toContain("Search suggestions");
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.stringify(vi.mocked(fetch).mock.calls[0]?.[1])).toContain("google_search");
  });

  it("does not expose a public-information summary without citations and Google search suggestions", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockResponse({
      candidates: [{
        content: { parts: [{ text: "An unsupported summary." }] },
        groundingMetadata: { groundingChunks: [], groundingSupports: [] },
      }],
    });

    const result = await searchGooglePublicInformation(business);

    expect(result.status).toBe("NO_GROUNDED_OUTPUT");
    expect(result.summary).toBeUndefined();
    expect(result.citations).toEqual([]);
    expect(result.searchSuggestionHtml).toBeUndefined();
  });

  it("returns a safe unavailable state when Google Search grounding is quota-limited", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockResponse({}, 429);

    const result = await searchGooglePublicInformation(business);

    expect(result.status).toBe("QUOTA_EXCEEDED");
    expect(result.citations).toEqual([]);
    expect(result.statusMessage).toContain("quota is exhausted");
  });
});
