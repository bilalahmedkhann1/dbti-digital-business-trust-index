import { describe, expect, it } from "vitest";
import type { Evidence, FactorScore } from "../shared/dbti";
import { calculateDbtiScore, calculateFactorScores, FACTOR_CONFIG, scoreBand } from "../lib/scoring";
import { NO_DATA_RESPONSE } from "./lib/gemini";
import { CollectionError, normalizePublicUrl } from "./lib/collectors/website";

function evidence(status: Evidence["status"], factor: Evidence["factor"] = "security"): Evidence {
  return {
    id: `${factor}-${status}`,
    factor,
    metric: "Test metric",
    value: null,
    status,
    source: "https://example.com",
    observedAt: "2026-08-20T00:00:00.000Z",
    description: "Test evidence.",
  };
}

describe("DBTI deterministic scoring", () => {
  it("keeps completely unverified factors neutral rather than automatically scoring them zero", () => {
    const factor = calculateFactorScores([evidence("UNVERIFIED")])[0];
    expect(factor).toMatchObject({ key: "security", score: 50, status: "UNVERIFIED", coverage: 0 });
  });

  it("generates the same factor breakdown for identical evidence", () => {
    const input = [evidence("VERIFIED_PASS"), evidence("PARTIAL"), evidence("UNVERIFIED", "seo")];
    expect(calculateFactorScores(input)).toEqual(calculateFactorScores(input));
  });

  it("maps a complete set of 100-point factors to the 1000-point scale", () => {
    const factors: FactorScore[] = FACTOR_CONFIG.map((config) => ({
      key: config.key,
      name: config.name,
      score: 100,
      weight: config.weight,
      weightedContribution: config.weight,
      status: "VERIFIED_PASS",
      coverage: 1,
      keyFinding: "Test finding.",
      metrics: [],
    }));
    expect(calculateDbtiScore(factors)).toBe(1000);
  });

  it("uses the required grade labels at each score boundary", () => {
    expect(scoreBand(900).grade).toBe("A+");
    expect(scoreBand(800).grade).toBe("A");
    expect(scoreBand(700).grade).toBe("B");
    expect(scoreBand(600).grade).toBe("C");
    expect(scoreBand(500).grade).toBe("D");
    expect(scoreBand(499).grade).toBe("F");
  });
});

describe("DBTI public-website safety", () => {
  it("rejects localhost and credential-bearing addresses before collection", () => {
    expect(() => normalizePublicUrl("http://localhost:3000")).toThrow(CollectionError);
    expect(() => normalizePublicUrl("https://user:pass@example.com")).toThrow(CollectionError);
  });
});

describe("DBTI grounded assistant", () => {
  it("uses the exact insufficient-evidence fallback phrase", () => {
    expect(NO_DATA_RESPONSE).toBe("I don't have enough verified data");
  });
});
