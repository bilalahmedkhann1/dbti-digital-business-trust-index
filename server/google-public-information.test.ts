import { describe, expect, it } from "vitest";
import { buildPublicSearchDetails, parseBingRssPublicSearchResults, parseFreePublicSearchResults } from "./lib/googlePublicInformation";

const bingRss = `
  <rss><channel>
    <item><title>Wikipedia</title><link>https://www.wikipedia.org/</link><description>Wikipedia is a free online encyclopedia.</description></item>
    <item><title>Wikipedia Main Page</title><link>https://en.wikipedia.org/wiki/Main_Page</link><description>The free encyclopedia main page.</description></item>
    <item><title>Unrelated result</title><link>https://unrelated.example/news</link><description>This result must not be included.</description></item>
  </channel></rss>
`;

const searchHtml = `
  <div class="result results_links">
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fabout">Example Company About</a>
    <a class="result__snippet">Example Company provides public product and support information.</a>
  </div>
  <div class="result results_links">
    <a class="result__a" href="https://example.com/contact">Contact Example Company</a>
    <a class="result__snippet">Contact details and customer support resources are listed here.</a>
  </div>
  <div class="result results_links">
    <a class="result__a" href="https://unrelated.example/news">Unrelated result</a>
    <a class="result__snippet">This result must not be included.</a>
  </div>
`;

describe("free public-information search", () => {
  it("builds a Google query from the extracted business name and submitted domain", () => {
    const details = buildPublicSearchDetails({ name: "Example Company", website: "https://www.example.com/", domain: "example.com" });
    expect(details.query).toBe("site:example.com Example Company");
    expect(details.searchUrl).toContain("https://www.google.com/search?q=");
    expect(decodeURIComponent(details.searchUrl)).toContain("site:example.com Example Company");
  });

  it("keeps same-domain search findings cited and separate from scoring", () => {
    const result = parseFreePublicSearchResults(searchHtml, "example.com");

    expect(result.status).toBe("AVAILABLE");
    expect(result.provider).toBe("PUBLIC_WEB_SEARCH");
    expect(result.summary).toContain("Example Company About");
    expect(result.citations).toEqual([
      { id: "public-search-source-1", title: "Example Company About", url: "https://example.com/about" },
      { id: "public-search-source-2", title: "Contact Example Company", url: "https://example.com/contact" },
    ]);
    expect(result.citationSupports).toHaveLength(2);
    expect(result.statusMessage).toContain("non-scoring supplement");
  });

  it("parses Bing RSS fallback findings with the same-domain citation boundary", () => {
    const result = parseBingRssPublicSearchResults(bingRss, "wikipedia.org");

    expect(result.status).toBe("AVAILABLE");
    expect(result.provider).toBe("PUBLIC_WEB_SEARCH");
    expect(result.citations).toEqual([
      { id: "public-search-source-1", title: "Wikipedia", url: "https://www.wikipedia.org/" },
      { id: "public-search-source-2", title: "Wikipedia Main Page", url: "https://en.wikipedia.org/wiki/Main_Page" },
    ]);
    expect(result.statusMessage).toContain("non-scoring supplement");
  });

  it("rejects unrelated results and returns no grounded output when none remain", () => {
    const result = parseFreePublicSearchResults(`
      <a class="result__a" href="https://unrelated.example/news">Unrelated result</a>
      <a class="result__snippet">Unrelated content.</a>
    `, "example.com");

    expect(result.status).toBe("NO_GROUNDED_OUTPUT");
    expect(result.summary).toBeUndefined();
    expect(result.citations).toEqual([]);
  });

  it("decodes safe HTML entities without rendering executable markup", () => {
    const result = parseFreePublicSearchResults(`
      <a class="result__a" href="https://example.com/about">Example &amp; Company</a>
      <a class="result__snippet">Public &lt;support&gt; information.</a>
    `, "example.com");

    expect(result.summary).toContain("Example & Company");
    expect(result.summary).toContain("Public <support> information.");
    expect(result.summary).not.toContain("<script");
  });
});
