import { describe, expect, it } from "vitest";
import { ACCESS_RESTRICTION_MESSAGE, isAccessRestrictionMessage } from "../client/src/lib/collectionStatus";
import { CollectionError, normalizePublicUrl } from "./lib/collectors/website";

describe("blocked-site recovery classification", () => {
  it("identifies the explicit server-side access restriction message", () => {
    expect(isAccessRestrictionMessage(ACCESS_RESTRICTION_MESSAGE)).toBe(true);
  });

  it("does not incorrectly present a recovery prompt for unrelated analysis errors", () => {
    expect(isAccessRestrictionMessage("The website URL must use HTTPS.")).toBe(false);
  });

  it("allows a specific public page while retaining unsafe-host protections for recovery retries", () => {
    expect(normalizePublicUrl("https://example.com/contact?region=us").href).toBe("https://example.com/contact?region=us");
    expect(() => normalizePublicUrl("http://localhost/contact")).toThrow(expect.objectContaining<Partial<CollectionError>>({ code: "UNSAFE_URL" }));
  });
});
