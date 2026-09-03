import type { DBTIResult, Evidence, FactorScore } from "@shared/dbti";

const now = new Date().toISOString();

const evidence: Evidence[] = [
  { id: "preview-security", factor: "security", metric: "HTTPS enabled", value: true, status: "VERIFIED_PASS", source: "https://preview.dbti.example/security", observedAt: now, description: "The preview business site resolves over HTTPS." },
  { id: "preview-contact", factor: "transparency", metric: "Contact email", value: "hello@northstar.example", status: "VERIFIED_PASS", source: "https://preview.dbti.example/contact", observedAt: now, description: "A public contact email is visible on the contact page." },
  { id: "preview-policy", factor: "legalCompliance", metric: "Privacy policy", value: true, status: "PARTIAL", source: "https://preview.dbti.example/privacy", observedAt: now, description: "A privacy policy link is present and publicly reachable." },
];

const factors: FactorScore[] = [
  { key: "security", name: "Security", score: 88, weight: 15, weightedContribution: 132, status: "VERIFIED_PASS", coverage: 0.9, keyFinding: "HTTPS is enabled and security signals are visible.", metrics: [evidence[0]] },
  { key: "transparency", name: "Transparency", score: 76, weight: 10, weightedContribution: 76, status: "VERIFIED_PASS", coverage: 0.8, keyFinding: "Public contact details support business transparency.", metrics: [evidence[1]] },
  { key: "legalCompliance", name: "Legal compliance", score: 68, weight: 10, weightedContribution: 68, status: "PARTIAL", coverage: 0.6, keyFinding: "A privacy policy is present, with room for clearer legal navigation.", metrics: [evidence[2]] },
];

export const DEV_PREVIEW_RESULT: DBTIResult = {
  scanMode: "WEBSITE_EVIDENCE",
  business: { name: "Northstar Works", website: "https://preview.dbti.example", domain: "preview.dbti.example" },
  classification: { industry: "Professional services", subcategory: "Business consulting", confidence: 86, evidence: ["Public service descriptions", "Business contact page"], provider: "deterministic" },
  publicInformation: { website: "https://preview.dbti.example", domain: "preview.dbti.example", description: "Development-only preview data for visual verification of the DBTI report interface.", location: "Remote", contactEmail: "hello@northstar.example", socialLinks: [], policies: ["https://preview.dbti.example/privacy"], verificationSignals: ["HTTPS", "Public contact page"] },
  factors,
  dbtiScore: 764,
  grade: "B",
  trustStatus: "Solid digital foundation",
  strengths: [factors[0]],
  weaknesses: [factors[2]],
  evidence,
  recommendations: [{ title: "Clarify legal navigation", priority: "Medium", reason: "The privacy policy is present but not prominent in the primary navigation.", evidence: "Privacy policy link observed", suggestedAction: "Add a clearly labeled legal footer group with privacy and terms links.", expectedImpact: "Improved transparency" }],
  explanation: "This development-only preview demonstrates how verified first-party evidence, deterministic scoring, and cited public context are presented together.",
  scanTimestamp: now,
  aiAvailable: false,
  aiStatus: "NO_GROUNDED_OUTPUT",
  aiStatusMessage: "Preview mode: deterministic evidence and recommendations are shown; no AI output is represented.",
  googlePublicInformation: { provider: "PUBLIC_WEB_SEARCH", status: "AVAILABLE", statusMessage: "Preview citations are clearly separated from the deterministic score.", summary: "Public context is displayed separately from the first-party score in this development preview.", citations: [{ id: "preview-citation", title: "Northstar Works — public business profile", url: "https://preview.dbti.example/about" }], citationSupports: [{ startIndex: 0, endIndex: 83, citationIds: ["preview-citation"] }], searchQuery: "site:preview.dbti.example preview.dbti.example", searchUrl: "https://www.google.com/search?q=site%3Apreview.dbti.example" },
};

export const DEV_PROTECTED_RESULT: DBTIResult = {
  ...DEV_PREVIEW_RESULT,
  scanMode: "PUBLIC_SEARCH_ONLY",
  factors: [],
  dbtiScore: null,
  grade: "UNAVAILABLE",
  trustStatus: "Website access restricted",
  strengths: [],
  weaknesses: [],
  evidence: [],
  explanation: "This protected-site preview demonstrates a truthful public-search-only report without claiming first-party collection or calculating a score.",
  googlePublicInformation: { ...DEV_PREVIEW_RESULT.googlePublicInformation, summary: "Public context remains separately cited while the first-party website is unavailable to the scanner." },
};

export const DEV_ASSISTED_RESULT: DBTIResult = {
  ...DEV_PREVIEW_RESULT,
  scanMode: "ASSISTED_EVIDENCE",
  userProvidedEvidence: { sourceUrl: "https://preview.dbti.example/contact", characterCount: 428, submittedAt: now },
  explanation: "This assisted preview demonstrates a reproducible score based only on visible evidence submitted by the user.",
};
