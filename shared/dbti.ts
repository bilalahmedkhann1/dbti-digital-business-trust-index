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
  provider: "deterministic" | "gemini" | "dbti-engine";
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

export type AiStatus = "AI_VALIDATED" | "NOT_CONFIGURED" | "QUOTA_EXCEEDED" | "UNAVAILABLE" | "NO_GROUNDED_OUTPUT";

export type GooglePublicInformationStatus = "AVAILABLE" | "NOT_CONFIGURED" | "QUOTA_EXCEEDED" | "UNAVAILABLE" | "NO_GROUNDED_OUTPUT";

export type GooglePublicCitation = {
  id: string;
  title: string;
  url: string;
};

export type GooglePublicCitationSupport = {
  startIndex: number;
  endIndex: number;
  citationIds: string[];
};

export type GooglePublicInformation = {
  provider: "GOOGLE_SEARCH" | "PUBLIC_WEB_SEARCH";
  status: GooglePublicInformationStatus;
  statusMessage: string;
  summary?: string;
  citations: GooglePublicCitation[];
  citationSupports: GooglePublicCitationSupport[];
  searchSuggestionHtml?: string;
};

export type DBTIScanMode = "WEBSITE_EVIDENCE" | "PUBLIC_SEARCH_ONLY" | "ASSISTED_EVIDENCE";

export type UserProvidedEvidence = {
  sourceUrl: string;
  characterCount: number;
  submittedAt: string;
};

export type DBTIResult = {
  scanMode: DBTIScanMode;
  business: Business;
  classification: ClassificationResult;
  publicInformation: PublicInformation;
  factors: FactorScore[];
  dbtiScore: number | null;
  grade: "A+" | "A" | "B" | "C" | "D" | "F" | "UNAVAILABLE";
  trustStatus: string;
  strengths: FactorScore[];
  weaknesses: FactorScore[];
  evidence: Evidence[];
  recommendations: Recommendation[];
  explanation: string;
  scanTimestamp: string;
  aiAvailable: boolean;
  aiStatus: AiStatus;
  aiStatusMessage: string;
  googlePublicInformation: GooglePublicInformation;
  userProvidedEvidence?: UserProvidedEvidence;
};

export type AnalysisResponse =
  | { ok: true; data: DBTIResult }
  | { ok: false; error: { code: string; message: string } };
