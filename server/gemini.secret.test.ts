import { describe, expect, it } from "vitest";

describe("Gemini API configuration", () => {
  it("accepts the configured server-side key", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key, "GEMINI_API_KEY must be configured server-side").toBeTruthy();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key!)}`);
    expect(response.ok, `Gemini key validation failed with HTTP ${response.status}`).toBe(true);
  }, 15_000);
});
