import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

import { CollectionError, fetchPublicHtml } from "./lib/collectors/website";

describe("public collector access restrictions", () => {
  beforeEach(() => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("<html>Access denied</html>", { status: 403, headers: { "content-type": "text/html" } }))));
  });

  it("reports bot-protected public sites as an access restriction rather than analyzing the denial page", async () => {
    await expect(fetchPublicHtml("https://example.com")).rejects.toEqual(expect.objectContaining<Partial<CollectionError>>({
      code: "ACCESS_DENIED",
      message: expect.stringContaining("may still work normally in a personal browser"),
    }));
  });
});
