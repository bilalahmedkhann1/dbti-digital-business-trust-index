// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { DBTIResult } from "../shared/dbti";

vi.mock("@/components/DBTIAssistant", () => ({ DBTIAssistant: () => null }));
vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  PolarAngleAxis: () => null,
  PolarGrid: () => null,
  PolarRadiusAxis: () => null,
  Radar: () => null,
  RadarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import { DBTIResults } from "@/components/DBTIResults";

const result: DBTIResult = {
  scanMode: "WEBSITE_EVIDENCE",
  business: { name: "Example Company", website: "https://example.com/", domain: "example.com" },
  classification: { industry: "Unable to verify", subcategory: "Unable to verify", confidence: 0, evidence: [], provider: "deterministic" },
  publicInformation: { website: "https://example.com/", domain: "example.com", socialLinks: [], policies: [], verificationSignals: [] },
  factors: [],
  dbtiScore: 644,
  grade: "B",
  trustStatus: "Established",
  strengths: [],
  weaknesses: [],
  evidence: [],
  recommendations: [],
  explanation: "A deterministic website-only score.",
  scanTimestamp: "2026-08-26T00:00:00.000Z",
  aiAvailable: false,
  aiStatus: "QUOTA_EXCEEDED",
  aiStatusMessage: "AI is unavailable.",
  googlePublicInformation: {
    provider: "GOOGLE_SEARCH",
    status: "AVAILABLE",
    statusMessage: "Google Search-grounded public information is shown separately.",
    summary: "A cited public-information summary.",
    citations: [{ id: "google-source-1", title: "Cited source", url: "https://source.example/article" }],
    citationSupports: [{ startIndex: 0, endIndex: 8, citationIds: ["google-source-1"] }],
    searchSuggestionHtml: '<a href="https://www.google.com/search?q=example" onclick="alert(1)">Google Search suggestions</a><img src="x" onerror="alert(1)">',
  },
};

afterEach(cleanup);

describe("Google public-information dashboard", () => {
  it("shows cited Google findings separately from the deterministic score and removes unsafe suggestion markup", () => {
    const { container } = render(<DBTIResults result={result} onNewScan={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Public web findings" })).toBeTruthy();
    expect(container.textContent).toMatch(/A cited\s+\[1\]public-information summary\./);
    expect(screen.getByRole("link", { name: "Citation 1: Cited source" })).toHaveProperty("href", "https://source.example/article");
    expect(screen.getAllByRole("link", { name: /cited source/i })).toHaveLength(2);
    expect(screen.getAllByText(/does not affect the deterministic DBTI score/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Google Search suggestions").textContent).toContain("Google Search suggestions");
    expect(container.innerHTML).not.toContain("onclick");
    expect(container.innerHTML).not.toContain("<img");
  });

  it("displays an attached Google results screenshot with user-browser provenance", () => {
    render(<DBTIResults result={{ ...result, googlePublicInformation: { ...result.googlePublicInformation, screenshotDataUrl: "data:image/png;base64,ZmFrZQ==", screenshotSource: "USER_BROWSER", screenshotSubmittedAt: "2026-08-31T00:00:00.000Z" } }} onNewScan={vi.fn()} />);

    expect(screen.getByText(/screenshot supplied from the user’s browser/i)).toBeTruthy();
    expect(screen.getByText(/Submitted 8\/31\/2026/i)).toBeTruthy();
    expect(screen.getAllByText(/does not affect the deterministic DBTI score/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByAltText(/Google search results for Example Company/i)).toHaveProperty("src", "data:image/png;base64,ZmFrZQ==");
  });

  it("explains protected-site limits and does not display a fabricated score", () => {
    render(<DBTIResults result={{ ...result, scanMode: "PUBLIC_SEARCH_ONLY", dbtiScore: null, grade: "UNAVAILABLE", trustStatus: "Website access restricted", googlePublicInformation: { ...result.googlePublicInformation, status: "UNAVAILABLE", statusMessage: "Google Search grounding is unavailable." } }} onNewScan={vi.fn()} />);

    expect(screen.getByText("First-party website evidence unavailable")).toBeTruthy();
    expect(screen.getByText(/does not calculate a dbti score/i)).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/not calculated/i)).toBeTruthy();
    expect(screen.getByText(/no deterministic score is shown/i)).toBeTruthy();
    expect(screen.getByText(/charts are unavailable/i)).toBeTruthy();
  });
});
