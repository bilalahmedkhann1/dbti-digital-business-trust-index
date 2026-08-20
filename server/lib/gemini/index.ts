import type { ClassificationResult, DBTIResult, Evidence, Recommendation } from "../../../shared/dbti";

const GEMINI_MODEL = "gemini-3.6-flash";
const NO_DATA_RESPONSE = "I don't have enough verified data";

type JsonRecord = Record<string, unknown>;

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

async function callGeminiJson(instruction: string, payload: string): Promise<JsonRecord> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${instruction}\n\n${payload}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`);
    const body: unknown = await response.json();
    const text = isRecord(body)
      ? (Array.isArray(body.candidates) && isRecord(body.candidates[0]) && isRecord(body.candidates[0].content) && Array.isArray(body.candidates[0].content.parts) && isRecord(body.candidates[0].content.parts[0]) && typeof body.candidates[0].content.parts[0].text === "string" ? body.candidates[0].content.parts[0].text : undefined)
      : undefined;
    if (!text) throw new Error("Gemini returned no usable content.");
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error("Gemini returned malformed JSON.");
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

export async function classifyWithGemini(
  current: ClassificationResult,
  business: DBTIResult["business"],
  publicInformation: DBTIResult["publicInformation"],
  evidence: Evidence[],
): Promise<ClassificationResult> {
  const response = await callGeminiJson(
    "Classify the business using only the facts below. Return JSON: {industry:string, subcategory:string, confidence:number, evidenceIds:string[]}. Never infer evidence that is not listed. Confidence must be 0-100.",
    `BUSINESS\nName: ${business.name}\nWebsite: ${publicInformation.website}\nDescription: ${publicInformation.description ?? "Unavailable"}\n\nEVIDENCE\n${evidenceContext(evidence)}`,
  );
  const industry = typeof response.industry === "string" ? response.industry.trim() : "";
  const subcategory = typeof response.subcategory === "string" ? response.subcategory.trim() : "";
  const confidence = typeof response.confidence === "number" && Number.isFinite(response.confidence) ? Math.max(0, Math.min(100, Math.round(response.confidence))) : 0;
  const cited = byEvidenceIds(strings(response.evidenceIds), evidence);
  if (!industry || !subcategory || cited.length === 0) return current;
  return { industry, subcategory, confidence, evidence: cited.map((item) => item.description), provider: "gemini" };
}

export async function recommendationsWithGemini(result: DBTIResult): Promise<Recommendation[]> {
  const response = await callGeminiJson(
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

export async function explanationWithGemini(result: DBTIResult): Promise<string> {
  const response = await callGeminiJson(
    "Explain this DBTI result in no more than three concise sentences using only the supplied evidence. Return JSON: {explanation:string,evidenceIds:string[]}. Cite at least one evidenceId and never infer unlisted facts.",
    `BUSINESS: ${result.business.name}\nDBTI SCORE: ${result.dbtiScore}/1000\nGRADE: ${result.grade}\n\nEVIDENCE\n${evidenceContext(result.evidence)}`,
  );
  const explanation = typeof response.explanation === "string" ? response.explanation.trim() : "";
  const cited = byEvidenceIds(strings(response.evidenceIds), result.evidence);
  return explanation && cited.length > 0 ? explanation : result.explanation;
}

export async function answerWithGemini(question: string, scan: DBTIResult): Promise<string> {
  const available = validEvidence(scan.evidence);
  if (available.length === 0) return NO_DATA_RESPONSE;
  try {
    const response = await callGeminiJson(
      `Answer the user's question using only the supplied DBTI evidence. Return JSON: {answer:string,evidenceIds:string[]}. The answer must explain only directly supported findings and must include at least one evidenceId. If there is insufficient support, return exactly: ${NO_DATA_RESPONSE}`,
      `QUESTION\n${question}\n\nBUSINESS\n${scan.business.name}\nScore: ${scan.dbtiScore}/1000\n\nEVIDENCE\n${evidenceContext(available)}`,
    );
    const answer = typeof response.answer === "string" ? response.answer.trim() : "";
    const cited = byEvidenceIds(strings(response.evidenceIds), available);
    if (!answer || cited.length === 0) return NO_DATA_RESPONSE;
    return answer;
  } catch {
    return NO_DATA_RESPONSE;
  }
}

export async function enrichWithGemini(result: DBTIResult): Promise<DBTIResult> {
  const outcomes = await Promise.allSettled([
    classifyWithGemini(result.classification, result.business, result.publicInformation, result.evidence),
    recommendationsWithGemini(result),
    explanationWithGemini(result),
  ]);
  const classification = outcomes[0].status === "fulfilled" ? outcomes[0].value : result.classification;
  const recommendations = outcomes[1].status === "fulfilled" ? outcomes[1].value : result.recommendations;
  const explanation = outcomes[2].status === "fulfilled" ? outcomes[2].value : result.explanation;
  return {
    ...result,
    classification,
    recommendations,
    explanation,
    aiAvailable: outcomes.some((outcome) => outcome.status === "fulfilled"),
  };
}

export { NO_DATA_RESPONSE };
