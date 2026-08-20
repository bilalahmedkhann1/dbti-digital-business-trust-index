export const METRIC_STATUSES = [
  "VERIFIED_PASS",
  "VERIFIED_FAIL",
  "PARTIAL",
  "UNVERIFIED",
  "NOT_APPLICABLE",
] as const;

export type MetricStatus = (typeof METRIC_STATUSES)[number];

export const FACTOR_KEYS = [
  "security",
  "seo",
  "performance",
  "contentQuality",
  "socialPresence",
  "legalCompliance",
  "mobile",
  "reliability",
  "transparency",
  "reputation",
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];

export type Evidence = {
  id: string;
  factor: FactorKey;
  metric: string;
  value: string | number | boolean | null;
  status: MetricStatus;
  source: string;
  observedAt: string;
  description: string;
};

export type PublicInformation = {
  website: string;
  domain: string;
  description?: string;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks: string[];
  policies: string[];
  verificationSignals: string[];
};

export type Business = {
  name: string;
  website: string;
  domain: string;
};

export type ClassificationResult = {
  industry: string;
  subcategory: string;
  confidence: number;
  evidence: string[];
  provider: "deterministic" | "gemini";
};

export type FactorScore = {
  key: FactorKey;
  name: string;
  score: number;
  weight: number;
  weightedContribution: number;
  status: MetricStatus;
  coverage: number;
  keyFinding: string;
  metrics: Evidence[];
};

export type Recommendation = {
  title: string;
  priority: "High" | "Medium" | "Low";
  reason: string;
  evidence: string;
  suggestedAction: string;
  expectedImpact?: string;
};

export type DBTIResult = {
  business: Business;
  classification: ClassificationResult;
  publicInformation: PublicInformation;
  factors: FactorScore[];
  dbtiScore: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  trustStatus: string;
  strengths: FactorScore[];
  weaknesses: FactorScore[];
  evidence: Evidence[];
  recommendations: Recommendation[];
  explanation: string;
  scanTimestamp: string;
  aiAvailable: boolean;
};

export type AnalysisResponse =
  | { ok: true; data: DBTIResult }
  | { ok: false; error: { code: string; message: string } };
