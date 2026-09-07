import { DBTIAssistant } from "@/components/DBTIAssistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DBTIResult, Evidence, FactorScore } from "@shared/dbti";
import DOMPurify from "dompurify";
import { ChevronDown, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PolarAngleAxis, PolarGrid, PolarRadiusAxis } from "recharts";

type ViewMode = "customer" | "owner";

const STATUS_LABELS: Record<FactorScore["status"], string> = {
  VERIFIED_PASS: "Verified",
  VERIFIED_FAIL: "Needs attention",
  PARTIAL: "Partial evidence",
  UNVERIFIED: "Unable to verify",
  NOT_APPLICABLE: "Not applicable",
};

function SectionTitle({ index, title, description }: { index: string; title: string; description?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-2 border-t border-[var(--border)] pt-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs tracking-[0.18em] text-[var(--muted-foreground)]">{index}</p>
        <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[var(--foreground)]">{title}</h2>
      </div>
      {description ? <p className="max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{description}</p> : null}
    </header>
  );
}

function SourceLink({ source }: { source: string }) {
  return (
    <a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline">
      Source <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function FactorDetail({ factor, ownerMode }: { factor: FactorScore; ownerMode: boolean }) {
  return (
    <details className="group border-b border-[var(--border)] py-4">
      <summary className="flex cursor-pointer list-none items-center gap-4 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--foreground)]">{factor.name}</p>
          <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{factor.keyFinding}</p>
        </div>
        <Badge variant="outline" className="border-[var(--border)] bg-transparent text-xs font-normal text-[var(--muted-foreground)]">{STATUS_LABELS[factor.status]}</Badge>
        <p className="w-12 text-right text-lg font-medium tabular-nums text-[var(--foreground)]">{factor.score}</p>
        <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)] transition duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 pt-5 md:grid-cols-[140px_1fr]">
        <div className="text-xs leading-5 text-[var(--muted-foreground)]">
          Weight {factor.weight}%<br />
          Contribution {factor.weightedContribution}/100<br />
          Evidence coverage {Math.round(factor.coverage * 100)}%
        </div>
        {ownerMode ? (
          <div className="space-y-3">
            {factor.metrics.map((item) => <EvidenceRow key={`${factor.key}-${item.id}`} evidence={item} />)}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">Switch to Business owner view to inspect the collected metric-level evidence.</p>
        )}
      </div>
    </details>
  );
}

function EvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <div className="rounded-lg bg-[var(--muted)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--foreground)]">{evidence.metric}</p>
        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">{evidence.status}</span>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">{evidence.description}</p>
      <div className="mt-2"><SourceLink source={evidence.source} /></div>
    </div>
  );
}

function GroundedSummary({ result }: { result: DBTIResult }) {
  const publicInformation = result.googlePublicInformation;
  const summary = publicInformation.summary ?? "";
  const citationById = new Map(publicInformation.citations.map((citation, index) => [citation.id, { ...citation, position: index + 1 }]));
  const supports = [...publicInformation.citationSupports]
    .sort((first, second) => first.startIndex - second.startIndex || first.endIndex - second.endIndex)
    .filter((support, index, list) => support.startIndex >= (index === 0 ? 0 : list[index - 1].endIndex));
  let cursor = 0;

  return (
    <p className="mt-4 max-w-4xl whitespace-pre-line text-sm leading-7 text-[var(--muted-foreground)]">
      {supports.flatMap((support, index) => {
        const leadingText = summary.slice(cursor, support.startIndex);
        const supportedText = summary.slice(support.startIndex, support.endIndex);
        cursor = support.endIndex;
        const references = support.citationIds.flatMap((id) => {
          const citation = citationById.get(id);
          return citation ? [citation] : [];
        });
        return [
          leadingText ? <span key={`text-${index}`}>{leadingText}</span> : null,
          <span key={`support-${index}`}>
            {supportedText}
            {references.length ? <sup className="ml-1 whitespace-nowrap">{references.map((citation, referenceIndex) => <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer" aria-label={`Citation ${citation.position}: ${citation.title}`} className="text-[var(--primary)] underline-offset-2 hover:underline">[{citation.position}{referenceIndex < references.length - 1 ? "," : ""}]</a>)}</sup> : null}
          </span>,
        ];
      })}
      {cursor < summary.length ? <span>{summary.slice(cursor)}</span> : null}
    </p>
  );
}

function GooglePublicInformationCard({ result }: { result: DBTIResult }) {
  const publicInformation = result.googlePublicInformation;
  const protectedSite = result.scanMode === "PUBLIC_SEARCH_ONLY";
  const assistedSite = result.scanMode === "ASSISTED_EVIDENCE";
  const safeSearchSuggestionHtml = publicInformation.searchSuggestionHtml
    ? DOMPurify.sanitize(publicInformation.searchSuggestionHtml, {
      ALLOWED_TAGS: ["a", "div", "span", "p", "ul", "ol", "li", "br", "strong", "em"],
      ALLOWED_ATTR: ["href", "class", "aria-label", "role"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    })
    : undefined;

  return (
    <article className="mt-8 border border-[var(--border)] bg-[var(--card)] p-5" aria-labelledby="google-public-information-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="data-label">Google public information</p>
          <h3 id="google-public-information-title" className="mt-2 text-lg font-medium text-[var(--foreground)]">Public web findings</h3>
          {publicInformation.searchQuery ? <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">Query: <span className="font-mono text-[var(--foreground)]">{publicInformation.searchQuery}</span></p> : null}
        </div>
        <Badge variant="outline" className="w-fit border-[var(--secondary)] bg-transparent text-xs font-normal text-[var(--foreground)]">
          {publicInformation.status === "AVAILABLE" ? (publicInformation.provider === "GOOGLE_SEARCH" ? "Google Search-grounded" : "Public-web search") : "Unavailable"}
        </Badge>
      </div>

      {publicInformation.searchUrl ? <a href={publicInformation.searchUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--primary)] underline-offset-4 hover:underline">Open this Google search <ExternalLink className="size-3" aria-hidden="true" /></a> : null}
      {publicInformation.status === "AVAILABLE" && publicInformation.summary ? (
        <>
          <GroundedSummary result={result} />
          <p className="mt-4 text-xs leading-5 text-[var(--muted-foreground)]">This source-cited public-information supplement does not affect the deterministic DBTI score.</p>
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="data-label">Sources cited by {publicInformation.provider === "GOOGLE_SEARCH" ? "Google Search" : "public-web search"}</p>
            <ul className="mt-3 space-y-2">
              {publicInformation.citations.map((citation) => (
                <li key={citation.id}>
                  <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--foreground)] underline-offset-4 hover:text-[var(--primary)] hover:underline">
                    {citation.title} <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {safeSearchSuggestionHtml ? (
            <div className="google-search-suggestions mt-5 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted-foreground)]" aria-label="Google Search suggestions" dangerouslySetInnerHTML={{ __html: safeSearchSuggestionHtml }} />
          ) : null}
        </>
      ) : (
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{publicInformation.statusMessage} {protectedSite ? "No deterministic score is shown because first-party website content was not available." : "The website-only evidence and deterministic score remain available."}</p>
      )}
      {publicInformation.screenshotDataUrl ? <figure className="mt-5 border-t border-[var(--border)] pt-4"><figcaption className="data-label">Google results screenshot supplied from the user’s browser</figcaption><p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">Submitted {publicInformation.screenshotSubmittedAt ? new Date(publicInformation.screenshotSubmittedAt).toLocaleString() : "without a recorded timestamp"}. This screenshot is user-provided and does not affect the deterministic DBTI score.</p><img src={publicInformation.screenshotDataUrl} alt={`Google search results for ${publicInformation.searchQuery ?? result.business.name}`} className="mt-3 max-h-[32rem] w-full rounded-lg border border-[var(--border)] object-contain object-left" /></figure> : null}
    </article>
  );
}

export function DBTIResults({ result, onNewScan }: { result: DBTIResult; onNewScan: () => void }) {
  const [view, setView] = useState<ViewMode>("customer");
  const ownerMode = view === "owner";
  const protectedSite = result.scanMode === "PUBLIC_SEARCH_ONLY";
  const assistedSite = result.scanMode === "ASSISTED_EVIDENCE";
  const factorData = result.factors.map((factor) => ({ name: factor.name.replace(" ", "\n"), score: factor.score, contribution: factor.weightedContribution }));

  return (
    <main className="dbti-shell dbti-results-shell pb-32" id="results">
      <div className="dbti-result-header flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--muted-foreground)]">ANALYSIS COMPLETE</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-[var(--foreground)]">{result.business.name}</h1>
          <a className="mt-1 inline-block text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]" href={result.business.website} target="_blank" rel="noreferrer">{result.business.domain}</a>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-[var(--border)] bg-[var(--card)] p-1" aria-label="Select analysis detail view">
            <Button variant="ghost" size="sm" onClick={() => setView("customer")} aria-pressed={view === "customer"} className={view === "customer" ? "rounded-full bg-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] hover:text-[var(--foreground)]" : "rounded-full text-[var(--muted-foreground)] hover:bg-transparent hover:text-[var(--foreground)]"}>Customer</Button>
            <Button variant="ghost" size="sm" onClick={() => setView("owner")} aria-pressed={view === "owner"} className={view === "owner" ? "rounded-full bg-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)] hover:text-[var(--foreground)]" : "rounded-full text-[var(--muted-foreground)] hover:bg-transparent hover:text-[var(--foreground)]"}>Business owner</Button>
          </div>
          <Button variant="outline" onClick={onNewScan} className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">New scan</Button>
        </div>
      </div>

      <section className="py-12" aria-labelledby="public-information-title">
        <SectionTitle index="01" title="Public Information" description="Website evidence is shown alongside separately attributed Google public information when source-grounded findings are available." />
        {protectedSite ? <div className="mb-8 border border-[var(--secondary)] bg-[var(--card)] p-5" role="status"><p className="data-label">First-party website evidence unavailable</p><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">The site refused DBTI server-side collection. This report uses public-search findings only where Google Search grounding returned cited sources; it does not claim to have scanned the protected website and does not calculate a DBTI score.</p></div> : null}
        {assistedSite && result.userProvidedEvidence ? <div className="mb-8 border border-[var(--secondary)] bg-[var(--card)] p-5" role="status"><p className="data-label">User-provided public evidence</p><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">DBTI analyzed visible text pasted by you from <a className="text-[var(--foreground)] underline" href={result.userProvidedEvidence.sourceUrl} target="_blank" rel="noreferrer">{result.userProvidedEvidence.sourceUrl}</a>. DBTI did not fetch this page from its server. The score uses only this submitted evidence and should be read as an assisted report.</p></div> : null}
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <div><p className="data-label">Website</p><a href={result.publicInformation.website} className="data-value link-value" target="_blank" rel="noreferrer">{result.publicInformation.website}</a></div>
          <div><p className="data-label">Industry</p><p className="data-value">{result.classification.industry}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{result.classification.confidence ? `${result.classification.confidence}% classification confidence` : "Insufficient public data"}</p></div>
          <div><p className="data-label">Contact</p><p className="data-value">{result.publicInformation.contactEmail ?? result.publicInformation.contactPhone ?? "Unable to verify"}</p></div>
          <div><p className="data-label">Verification signals</p><p className="data-value">{result.publicInformation.verificationSignals.length ? result.publicInformation.verificationSignals.join(", ") : "Unable to verify"}</p></div>
          {result.publicInformation.description ? <div className="md:col-span-2"><p className="data-label">Description</p><p className="max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">{result.publicInformation.description}</p></div> : null}
        </div>
        <GooglePublicInformationCard result={result} />
      </section>

      <section className="py-12" aria-labelledby="score-title">
        <SectionTitle index="02" title="DBTI Score" description={protectedSite ? "A numerical score requires collected first-party website evidence." : assistedSite ? "A reproducible calculation based only on the visible evidence you submitted." : "A reproducible weighted calculation based on the observed evidence."} />
        <div className="dbti-score-hero grid items-end gap-8 p-6 lg:grid-cols-[1fr_1.1fr] lg:p-8">
          <div className="border-l border-[var(--foreground)] pl-6">
            <p className="text-7xl font-medium leading-none tracking-[-0.08em] text-[var(--foreground)] sm:text-8xl">{result.dbtiScore ?? "—"}</p>
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">{protectedSite ? "not calculated" : "out of 1000"}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div><p className="data-label">Grade</p><p className="mt-2 text-3xl font-medium text-[var(--foreground)]">{result.grade === "UNAVAILABLE" ? "—" : result.grade}</p></div>
            <div><p className="data-label">Trust status</p><p className="mt-2 text-lg text-[var(--foreground)]">{result.trustStatus}</p></div>
            <div><p className="data-label">Scanned</p><p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{new Date(result.scanTimestamp).toLocaleString()}</p></div>
          </div>
        </div>
        <p className="mt-10 max-w-3xl text-base leading-7 text-[var(--muted-foreground)]">{result.explanation}</p>
      </section>

      <section className="py-12" aria-labelledby="breakdown-title">
        <SectionTitle index="03" title="Score Breakdown" description="Expand a factor to see its collected evidence and its deterministic contribution." />
        {result.factors.length ? <div>{result.factors.map((factor) => <FactorDetail key={factor.key} factor={factor} ownerMode={ownerMode} />)}</div> : <p className="text-sm leading-6 text-[var(--muted-foreground)]">No factor scores were calculated because first-party website evidence was unavailable.</p>}
      </section>

      <section className="py-12" aria-labelledby="charts-title">
        <SectionTitle index="04" title="Interactive Charts" description="Visualizations are calculated directly from this scan's factor scores." />
        {factorData.length ? <div className="grid gap-6 lg:grid-cols-2">
          <div className="dbti-result-card h-[320px] p-4"><p className="data-label">Factor radar</p><ResponsiveContainer width="100%" height="92%"><RadarChart data={factorData}><PolarGrid stroke="var(--secondary)" /><PolarAngleAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="score" stroke="var(--foreground)" fill="var(--primary)" fillOpacity={0.42} /></RadarChart></ResponsiveContainer></div>
          <div className="dbti-result-card h-[320px] p-4"><p className="data-label">Weighted contribution</p><ResponsiveContainer width="100%" height="92%"><BarChart data={factorData} margin={{ top: 16, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="var(--secondary)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval={0} /><YAxis tick={{ fill: "var(--foreground)", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--secondary)", color: "var(--foreground)" }} cursor={{ fill: "var(--background)" }} /><Bar dataKey="contribution" radius={0}>{factorData.map((factor) => <Cell key={factor.name} fill="var(--secondary)" />)}</Bar></BarChart></ResponsiveContainer></div>
        </div> : <p className="text-sm leading-6 text-[var(--muted-foreground)]">Charts are unavailable until first-party website evidence can be collected.</p>}
      </section>

      <section className="py-12" aria-labelledby="evidence-title">
        <SectionTitle index="05" title="Evidence" description="Every visible finding records the observed source and evidence status." />
        {ownerMode ? <div className="grid gap-3 md:grid-cols-2">{result.evidence.map((item) => <EvidenceRow evidence={item} key={item.id} />)}</div> : <p className="text-sm leading-6 text-[var(--muted-foreground)]">Switch to Business owner view to inspect the complete evidence ledger.</p>}
      </section>

      <section className="py-12" aria-labelledby="strengths-title">
        <SectionTitle index="06" title="Strengths" />
        <div className="grid gap-3 md:grid-cols-3">{result.strengths.map((factor) => <div key={factor.key} className="dbti-result-card p-5"><ShieldCheck className="size-4 text-[var(--foreground)]" aria-hidden="true" /><p className="mt-6 text-lg text-[var(--foreground)]">{factor.name}</p><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{factor.keyFinding}</p></div>)}</div>
      </section>

      <section className="py-12" aria-labelledby="weaknesses-title">
        <SectionTitle index="07" title="Weaknesses" />
        <div className="grid gap-3 md:grid-cols-3">{result.weaknesses.map((factor) => <div key={factor.key} className="dbti-result-card p-5"><ShieldAlert className="size-4 text-[var(--foreground)]" aria-hidden="true" /><p className="mt-6 text-lg text-[var(--foreground)]">{factor.name}</p><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{factor.keyFinding}</p></div>)}</div>
      </section>

      <section className="py-12" aria-labelledby="recommendations-title">
        <SectionTitle index="08" title="Recommendations" description="AI insights are shown only after evidence validation; otherwise DBTI provides deterministic recommendations tied to observed evidence." />
        <p className="mb-5 text-sm leading-6 text-[var(--muted-foreground)]" role="status">{result.aiStatusMessage}</p>
        {result.recommendations.length ? <div className="space-y-3">{result.recommendations.map((recommendation) => <article key={recommendation.title} className="dbti-result-card p-5"><p className="text-xs tracking-[0.12em] text-[var(--muted-foreground)]">{recommendation.priority} PRIORITY</p><h3 className="mt-3 text-lg text-[var(--foreground)]">{recommendation.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{recommendation.reason}</p><p className="mt-4 text-sm leading-6 text-[var(--foreground)]">{recommendation.suggestedAction}</p></article>)}</div> : <p className="text-sm leading-6 text-[var(--muted-foreground)]">No verified failures or partial signals were available to support a recommendation in this scan.</p>}
      </section>

      <section className="py-12" aria-labelledby="assistant-title">
        <SectionTitle index="09" title="DBTI Assistant" description="Open the floating assistant to ask about this specific scan." />
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">The assistant is constrained to verified evidence from the current scan. {result.aiAvailable ? "Gemini was available for scan-level interpretation." : "Gemini was not available for validated scan-level interpretation; the assistant will not fabricate a response."} When supporting evidence is insufficient, it responds: “I don&apos;t have enough verified data”.</p>
      </section>
      <DBTIAssistant result={result} />
    </main>
  );
}
