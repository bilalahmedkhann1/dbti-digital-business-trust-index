import { invokeLLM } from "../../_core/llm";
import type { AiStatus, ClassificationResult, DBTIResult, Evidence, Recommendation } from "../../../shared/dbti";
const DBTI_MODEL = "gpt-5-mini";

const NO_DATA_RESPONSE = "I don't have enough verified data";

type JsonRecord = Record<string, unknown>;

class IntelligenceError extends Error {
  constructor(public readonly code: "QUOTA_EXCEEDED" | "UNAVAILABLE", message: string) {
    super(message);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function validEvidence(evidence: Evidence[]): Evidence[] {
  return evidence.filter((item) => item.status === "VERIFIED_PASS" || item.status === "VERIFIED_FAIL" || item.status === "PARTIAL");
}

function evidenceContext(evidence: Evidence[]): string {
  return validEvidence(evidence).slice(0, 45).map((item) => `${item.id} | ${item.factor} | ${item.metric} | ${item.status} | ${item.description}`).join("\n");
}

function byEvidenceIds(ids: string[], evidence: Evidence[]): Evidence[] {
  const allowed = new Map(validEvidence(evidence).map((item) => [item.id, item]));
  const unique = [...new Set(ids)].map((id) => allowed.get(id)).filter((item): item is Evidence => Boolean(item));
  return unique;
}

function deterministicRecommendations(result: DBTIResult): Recommendation[] {
  return validEvidence(result.evidence)
    .filter((item) => item.status === "VERIFIED_FAIL" || item.status === "PARTIAL")
    .slice(0, 4)
    .map((item) => ({
      title: `Review ${item.metric}`,
      priority: item.status === "VERIFIED_FAIL" ? "High" : "Medium",
      reason: item.description,
      evidence: item.description,
      suggestedAction: `Review the observed ${item.metric.toLowerCase()} signal and address it where applicable.`,
    }));
}

function isScoreExplanationQuestion(question: string) {
  return /\b(score|grade|trust|low|why)\b/i.test(question);
}

function deterministicScoreExplanation(scan: DBTIResult): string | undefined {
  const supportedFactors = scan.factors
    .filter((factor) => factor.metrics.some((item) => item.status === "VERIFIED_FAIL" || item.status === "PARTIAL"))
    .sort((first, second) => first.score - second.score || first.weightedContribution - second.weightedContribution)
    .slice(0, 3);

  if (supportedFactors.length === 0) return undefined;
  const findings = supportedFactors.map((factor) => `${factor.name} (${factor.score}/100): ${factor.keyFinding}`).join(" ");
  return `Your DBTI score is ${scan.dbtiScore}/1000 (${scan.grade}). The scan's lowest evidence-supported factor signals are: ${findings} These conclusions are based on verified or partial evidence collected in this scan.`;
}

function deterministicAssistantAnswer(question: string, scan: DBTIResult): string | undefined {
  if (isScoreExplanationQuestion(question)) return deterministicScoreExplanation(scan);

  if (/\b(fix|improve|recommend|first)\b/i.test(question) && scan.recommendations.length > 0) {
    const recommendations = scan.recommendations.slice(0, 3).map((item) => `${item.title}: ${item.reason}`).join(" ");
    return `The evidence-supported improvements identified in this scan are: ${recommendations}`;
  }

  const factor = scan.factors.find((item) => question.toLowerCase().includes(item.name.toLowerCase()) && item.metrics.some((metric) => metric.status === "VERIFIED_PASS" || metric.status === "VERIFIED_FAIL" || metric.status === "PARTIAL"));
  if (factor) return `${factor.name} scored ${factor.score}/100. ${factor.keyFinding} This summary is based on the scan's verified or partial evidence for that factor.`;
  return undefined;
}

async function callDbtiJson(instruction: string, payload: string): Promise<JsonRecord> {
  if (!process.env.BUILT_IN_FORGE_API_KEY) {
    throw new IntelligenceError("UNAVAILABLE", "The DBTI intelligence engine is not configured.");
  }
  try {
    const response = await Promise.race([
      invokeLLM({
      model: DBTI_MODEL,
      messages: [
        { role: "system", content: "You are the DBTI evidence intelligence engine. Return JSON only. Never invent facts, and cite only supplied evidence IDs." },
        { role: "user", content: `${instruction}\n\n${payload}` },
      ],
      maxTokens: 2000,
      responseFormat: { type: "json_object" },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new IntelligenceError("UNAVAILABLE", "The DBTI intelligence engine did not respond before the short analysis deadline.")), 900)),
    ]);
    const raw = response.choices[0]?.message.content;
    const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.filter((part): part is { type: "text"; text: string } => part.type === "text").map((part) => part.text).join("\n") : "";
    if (!text) throw new IntelligenceError("UNAVAILABLE", "DBTI intelligence engine returned no usable content.");
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new IntelligenceError("UNAVAILABLE", "DBTI intelligence engine returned malformed JSON.");
    return parsed;
  } catch (error) {
    if (error instanceof IntelligenceError) throw error;
    const message = error instanceof Error ? error.message : "DBTI intelligence engine could not be reached.";
    if (/429|quota|rate limit/i.test(message)) throw new IntelligenceError("QUOTA_EXCEEDED", "DBTI intelligence engine is temporarily rate-limited.");
    throw new IntelligenceError("UNAVAILABLE", message.slice(0, 180));
  }
}

export async function classifyWithDbtiEngine(
  current: ClassificationResult,
  business: DBTIResult["business"],
  publicInformation: DBTIResult["publicInformation"],
  evidence: Evidence[],
): Promise<ClassificationResult> {
  const response = await callDbtiJson(
    "Classify the business using only the facts below. Return JSON: {industry:string, subcategory:string, confidence:number, evidenceIds:string[]}. Never infer evidence that is not listed. Confidence must be 0-100.",
    `BUSINESS\nName: ${business.name}\nWebsite: ${publicInformation.website}\nDescription: ${publicInformation.description ?? "Unavailable"}\n\nEVIDENCE\n${evidenceContext(evidence)}`,
  );
  const industry = typeof response.industry === "string" ? response.industry.trim() : "";
  const subcategory = typeof response.subcategory === "string" ? response.subcategory.trim() : "";
  const confidence = typeof response.confidence === "number" && Number.isFinite(response.confidence) ? Math.max(0, Math.min(100, Math.round(response.confidence))) : 0;
  const cited = byEvidenceIds(strings(response.evidenceIds), evidence);
  if (!industry || !subcategory || cited.length === 0) return current;
  return { industry, subcategory, confidence, evidence: cited.map((item) => item.description), provider: "dbti-engine" };
}

export async function recommendationsWithDbtiEngine(result: DBTIResult): Promise<Recommendation[]> {
  const response = await callDbtiJson(
    "Generate concise prioritized improvements only from the evidence below. Return JSON: {recommendations:[{title:string, priority:'High'|'Medium'|'Low', suggestedAction:string, evidenceIds:string[]}]}. Every item must cite one or more listed evidenceIds. Do not claim numerical impact or make up findings.",
    `BUSINESS: ${result.business.name}\nFACTOR SCORES:\n${result.factors.map((factor) => `${factor.key}: ${factor.score}/100`).join("\n")}\n\nEVIDENCE\n${evidenceContext(result.evidence)}`,
  );
  const raw = Array.isArray(response.recommendations) ? response.recommendations : [];
  return raw.slice(0, 5).flatMap((item): Recommendation[] => {
    if (!isRecord(item) || typeof item.title !== "string" || typeof item.suggestedAction !== "string" || !["High", "Medium", "Low"].includes(String(item.priority))) return [];
    const cited = byEvidenceIds(strings(item.evidenceIds), result.evidence);
    if (cited.length === 0) return [];
    const evidenceText = cited.map((evidence) => evidence.description).join(" ");
    return [{
      title: item.title.trim(),
      priority: item.priority as Recommendation["priority"],
      reason: evidenceText,
      evidence: evidenceText,
      suggestedAction: item.suggestedAction.trim(),
    }];
  });
}

export async function explanationWithDbtiEngine(result: DBTIResult): Promise<string> {
  const response = await callDbtiJson(
    "Explain this DBTI result in no more than three concise sentences using only the supplied evidence. Return JSON: {explanation:string,evidenceIds:string[]}. Cite at least one evidenceId and never infer unlisted facts.",
    `BUSINESS: ${result.business.name}\nDBTI SCORE: ${result.dbtiScore}/1000\nGRADE: ${result.grade}\n\nEVIDENCE\n${evidenceContext(result.evidence)}`,
  );
  const explanation = typeof response.explanation === "string" ? response.explanation.trim() : "";
  const cited = byEvidenceIds(strings(response.evidenceIds), result.evidence);
  return explanation && cited.length > 0 ? explanation : result.explanation;
}

export async function answerWithDbtiEngine(question: string, scan: DBTIResult): Promise<string> {
  const available = validEvidence(scan.evidence);
  if (available.length === 0) return NO_DATA_RESPONSE;
  const fallback = deterministicAssistantAnswer(question, scan);
  try {
    const response = await callDbtiJson(
      `Answer the user's question using only the supplied DBTI evidence. Return JSON: {answer:string,evidenceIds:string[]}. The answer must explain only directly supported findings and must include at least one evidenceId. If there is insufficient support, return exactly: ${NO_DATA_RESPONSE}`,
      `QUESTION\n${question}\n\nBUSINESS\n${scan.business.name}\nScore: ${scan.dbtiScore}/1000\n\nEVIDENCE\n${evidenceContext(available)}`,
    );
    const answer = typeof response.answer === "string" ? response.answer.trim() : "";
    const cited = byEvidenceIds(strings(response.evidenceIds), available);
    if (!answer || cited.length === 0) return fallback ?? NO_DATA_RESPONSE;
    return answer;
  } catch (error) {
    if (fallback) return fallback;
    if (error instanceof IntelligenceError && error.code === "QUOTA_EXCEEDED") {
      return "The DBTI intelligence engine is temporarily rate-limited, so I can't provide a grounded AI response for this scan right now. Review the verified evidence below or try again later.";
    }
    return NO_DATA_RESPONSE;
  }
}

export const classifyWithGemini = classifyWithDbtiEngine;
export const recommendationsWithGemini = recommendationsWithDbtiEngine;
export const explanationWithGemini = explanationWithDbtiEngine;
export const answerWithGemini = answerWithDbtiEngine;
export const enrichWithGemini = enrichWithDbtiEngine;

export async function enrichWithDbtiEngine(result: DBTIResult): Promise<DBTIResult> {
  if (!process.env.BUILT_IN_FORGE_API_KEY) {
    return {
      ...result,
      recommendations: deterministicRecommendations(result),
      aiAvailable: false,
      aiStatus: "NOT_CONFIGURED",
      aiStatusMessage: "The DBTI intelligence engine is not configured. The recommendations below are deterministic and linked to this scan's observed evidence.",
    };
  }
  const outcomes = await Promise.allSettled([
    classifyWithDbtiEngine(result.classification, result.business, result.publicInformation, result.evidence),
    recommendationsWithDbtiEngine(result),
    explanationWithDbtiEngine(result),
  ]);
  const classification = outcomes[0].status === "fulfilled" ? outcomes[0].value : result.classification;
  const generatedRecommendations = outcomes[1].status === "fulfilled" ? outcomes[1].value : [];
  const explanation = outcomes[2].status === "fulfilled" ? outcomes[2].value : result.explanation;
  const aiAvailable = classification.provider === "dbti-engine" || generatedRecommendations.length > 0 || explanation !== result.explanation;
  const quotaExhausted = outcomes.some((outcome) => outcome.status === "rejected" && outcome.reason instanceof IntelligenceError && outcome.reason.code === "QUOTA_EXCEEDED");
  const aiStatus: AiStatus = aiAvailable ? "AI_VALIDATED" : quotaExhausted ? "QUOTA_EXCEEDED" : outcomes.some((outcome) => outcome.status === "fulfilled") ? "NO_GROUNDED_OUTPUT" : "UNAVAILABLE";
  const aiStatusMessage = aiStatus === "AI_VALIDATED"
    ? "The DBTI intelligence engine produced evidence-validated insights for this scan."
    : aiStatus === "QUOTA_EXCEEDED"
      ? "The DBTI intelligence engine is temporarily rate-limited. Deterministic evidence-backed recommendations are shown instead; try again later to enable enriched insights."
    : aiStatus === "NO_GROUNDED_OUTPUT"
      ? "The DBTI intelligence engine did not return recommendations that could be validated against this scan. Deterministic evidence-backed recommendations are shown instead."
      : "The DBTI intelligence engine could not be reached for this scan. Deterministic evidence-backed recommendations are shown instead.";
  return {
    ...result,
    classification,
    recommendations: generatedRecommendations.length ? generatedRecommendations : deterministicRecommendations(result),
    explanation,
    aiAvailable,
    aiStatus,
    aiStatusMessage,
  };
}

export { NO_DATA_RESPONSE };
