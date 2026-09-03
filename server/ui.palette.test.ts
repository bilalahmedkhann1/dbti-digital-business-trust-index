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
    ["#EDEBDE", "#810100", "#630102", "#1B1716"].forEach((color) => expect(css).toContain(color));
    expect(css).not.toContain("#007AFF");
    expect(css).not.toContain("#5856D6");
    expect(css).not.toContain("#34C759");
    expect(contrast("#EDEBDE", "#1B1716")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#1B1716", "#EDEBDE")).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves the mobile-first search layout and readable desktop type breakpoint", async () => {
    const home = await readFile(resolve(clientPath, "pages/Home.tsx"), "utf8");
    expect(home).toContain("w-full max-w-2xl");
    expect(home).toContain("px-5 sm:px-8");
    expect(home).toContain("sm:text-7xl");
    expect(home).toContain("dbti-search");
    expect(home).toContain("placeholder:text-[var(--surface-foreground)]");
  });

  it("keeps every user-facing analysis surface on the supplied palette", async () => {
    const files = ["components/DBTIResults.tsx", "components/AnalysisProgress.tsx", "components/DBTIAssistant.tsx", "../index.html"];
    const legacyColors = ["#007AFF", "#5856D6", "#34C759", "#1C1C1E", "#0B0B0B", "#111111", "#171717", "#262626", "#F5F5F5", "#A1A1A1"];
    for (const file of files) {
      const content = await readFile(resolve(clientPath, file), "utf8");
      legacyColors.forEach((color) => expect(content, `${file} still contains ${color}`).not.toContain(color));
    }
  });

  it("uses Cotton as the initial light theme and Noir Black as the dark theme", async () => {
    const css = await readFile(resolve(clientPath, "index.css"), "utf8");
    const app = await readFile(resolve(clientPath, "App.tsx"), "utf8");
    const toggle = await readFile(resolve(clientPath, "components/ThemeToggle.tsx"), "utf8");
    expect(css).toContain(":root {");
    expect(css).toContain("--background: #EDEBDE;");
    expect(css).toContain(".dark {");
    expect(css).toContain("--background: #1B1716;");
    expect(app).toContain('defaultTheme="light" switchable');
    expect(app).toContain("<ThemeToggle />");
    expect(toggle).toContain('aria-label={label}');
    expect(toggle).toContain("fixed bottom-5 right-5 z-50");
  });

  it("keeps theme toggle controls keyboard-addressable and preference-aware", async () => {
    const context = await readFile(resolve(clientPath, "contexts/ThemeContext.tsx"), "utf8");
    const toggle = await readFile(resolve(clientPath, "components/ThemeToggle.tsx"), "utf8");
    expect(context).toContain('localStorage.getItem("theme")');
    expect(context).toContain('localStorage.setItem("theme", theme)');
    expect(toggle).toContain('type="button"');
    expect(toggle).toContain("aria-pressed={theme === \"dark\"}");
  });
});
