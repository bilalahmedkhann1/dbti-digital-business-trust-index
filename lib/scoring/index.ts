import type { Evidence, FactorKey, FactorScore, MetricStatus } from "../../shared/dbti";

export const FACTOR_CONFIG: ReadonlyArray<{ key: FactorKey; name: string; weight: number }> = [
  { key: "security", name: "Security", weight: 16 },
  { key: "seo", name: "SEO", weight: 11 },
  { key: "performance", name: "Performance", weight: 11 },
  { key: "contentQuality", name: "Content Quality", weight: 10 },
  { key: "socialPresence", name: "Social Presence", weight: 7 },
  { key: "legalCompliance", name: "Legal Compliance", weight: 10 },
  { key: "mobile", name: "Mobile", weight: 8 },
  { key: "reliability", name: "Reliability", weight: 10 },
  { key: "transparency", name: "Transparency", weight: 9 },
  { key: "reputation", name: "Reputation", weight: 8 },
] as const;

const NEUTRAL_MISSING_SCORE = 50;

function statusScore(status: MetricStatus): number {
  if (status === "VERIFIED_PASS") return 100;
  if (status === "PARTIAL") return 60;
  return 0;
}

function scoreMetrics(metrics: Evidence[]) {
  const scoreable = metrics.filter(
    (metric) => metric.status !== "UNVERIFIED" && metric.status !== "NOT_APPLICABLE",
  );
  const coverage = metrics.length === 0 ? 0 : scoreable.length / metrics.length;

  if (scoreable.length === 0) {
    return { score: NEUTRAL_MISSING_SCORE, coverage, status: "UNVERIFIED" as const };
  }

  const score = Math.round(
    scoreable.reduce((total, metric) => total + statusScore(metric.status), 0) / scoreable.length,
  );
  const status: MetricStatus =
    coverage < 0.5 ? "PARTIAL" : score >= 75 ? "VERIFIED_PASS" : score <= 35 ? "VERIFIED_FAIL" : "PARTIAL";

  return { score, coverage, status };
}

function describeFinding(metrics: Evidence[]): string {
  const finding = metrics.find((metric) => metric.status === "VERIFIED_FAIL")
    ?? metrics.find((metric) => metric.status === "PARTIAL")
    ?? metrics.find((metric) => metric.status === "VERIFIED_PASS")
    ?? metrics[0];
  return finding?.description ?? "Insufficient public data.";
}

export function calculateFactorScores(evidence: Evidence[]): FactorScore[] {
  return FACTOR_CONFIG.map((config) => {
    const metrics = evidence.filter((item) => item.factor === config.key);
    const result = scoreMetrics(metrics);
    return {
      key: config.key,
      name: config.name,
      score: result.score,
      weight: config.weight,
      weightedContribution: Number(((result.score * config.weight) / 100).toFixed(1)),
      status: result.status,
      coverage: Number(result.coverage.toFixed(2)),
      keyFinding: describeFinding(metrics),
      metrics,
    };
  });
}

export function calculateDbtiScore(factors: FactorScore[]): number {
  const weightedScore = factors.reduce((total, factor) => total + factor.score * factor.weight, 0) / 100;
  return Math.round(weightedScore * 10);
}

export function scoreBand(score: number): { grade: "A+" | "A" | "B" | "C" | "D" | "F"; trustStatus: string } {
  if (score >= 900) return { grade: "A+", trustStatus: "Highly Trusted" };
  if (score >= 800) return { grade: "A", trustStatus: "Trusted" };
  if (score >= 700) return { grade: "B", trustStatus: "Generally Trusted" };
  if (score >= 600) return { grade: "C", trustStatus: "Moderate Trust" };
  if (score >= 500) return { grade: "D", trustStatus: "Low Trust" };
  return { grade: "F", trustStatus: "Very Low Trust" };
}
