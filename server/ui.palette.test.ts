import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientPath = resolve(process.cwd(), "client/src");

function channel(value: string) {
  return Number.parseInt(value, 16) / 255;
}

function luminance(hex: string) {
  const values = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(channel).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("DBTI refreshed palette and responsive layout contracts", () => {
  it("uses only the supplied core palette for theme tokens and preserves high-contrast text surfaces", async () => {
    const css = await readFile(resolve(clientPath, "index.css"), "utf8");
    ["#FFFFFF", "#1C1C1E", "#007AFF", "#5856D6", "#34C759"].forEach((color) => expect(css).toContain(color));
    expect(css).not.toContain("#524646");
    expect(css).not.toContain("#EC5B38");
    expect(contrast("#FFFFFF", "#1C1C1E")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#1C1C1E", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves the mobile-first search layout and readable desktop type breakpoint", async () => {
    const home = await readFile(resolve(clientPath, "pages/Home.tsx"), "utf8");
    expect(home).toContain("w-full max-w-2xl");
    expect(home).toContain("px-5 sm:px-8");
    expect(home).toContain("sm:text-6xl");
    expect(home).toContain("!bg-[#FFFFFF]");
  });
});
