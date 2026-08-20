import { describe, expect, it } from "vitest";

describe("Gemini generation", () => {
  it("returns structured content from the configured DBTI model", async () => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY!)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Return JSON exactly: {\"ok\":true}" }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    const responseText = await response.text();
    expect(response.ok, `Gemini generation failed with HTTP ${response.status}: ${responseText.slice(0, 300)}`).toBe(true);
    expect(JSON.parse(responseText)).toHaveProperty("candidates");
  }, 20_000);
});
