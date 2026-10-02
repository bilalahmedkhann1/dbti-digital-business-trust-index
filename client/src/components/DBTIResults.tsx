import { DBTIAssistant } from "@/components/DBTIAssistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DBTIResult, Evidence, FactorScore } from "@shared/dbti";
import DOMPurify from "dompurify";
import { Activity, ArrowUpRight, ChevronDown, ExternalLink, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
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

function SectionTitle({ id, index, title, description }: { id: string; index: string; title: string; description?: string }) {
  return (
    <header className="dbti-section-head">
      <div className="dbti-section-marker" aria-hidden="true">
        <span className="dbti-section-number">{index}</span>
        <span className="dbti-section-line" />
      </div>
      <div className="dbti-section-copy">
        <h2 id={id} className="dbti-section-title">{title}</h2>
        {description ? <p className="dbti-section-description">{description}</p> : null}
      </div>
    </header>
  );
}

function SourceLink({ source }: { source: string }) {
  return (
    <a href={source} target="_blank" rel="noreferrer" className="dbti-source-link">
      Source <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function FactorDetail({ factor, ownerMode }: { factor: FactorScore; ownerMode: boolean }) {
  return (
    <details className="dbti-factor-row group">
      <summary className="dbti-factor-summary rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]">
        <span className="dbti-factor-code" aria-hidden="true">{factor.key.slice(0, 2).toUpperCase()}</span>
        <div className="dbti-factor-name">
          <p>{factor.name}</p>
          <span>{factor.keyFinding}</span>
        </div>
        <Badge variant="outline" className="dbti-factor-status">{STATUS_LABELS[factor.status]}</Badge>
        <p className="dbti-factor-score">{factor.score}</p>
        <ChevronDown className="dbti-factor-chevron size-4 shrink-0" aria-hidden="true" />
      </summary>
      <div className="dbti-factor-detail">
        <div className="dbti-factor-metrics">
          <span>Weight <strong>{factor.weight}%</strong></span>
          <span>Contribution <strong>{factor.weightedContribution}/100</strong></span>
          <span>Coverage <strong>{Math.round(factor.coverage * 100)}%</strong></span>
        </div>
        {ownerMode ? (
          <div className="space-y-3">
            {factor.metrics.map((item) => <EvidenceRow key={`${factor.key}-${item.id}`} evidence={item} />)}
          </div>
        ) : (
          <p className="dbti-empty-note">Switch to Business owner view to inspect the collected metric-level evidence.</p>
        )}
      </div>
    </details>
  );
}

function EvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <div className="dbti-evidence-row">
      <div className="dbti-evidence-row-head">
        <p>{evidence.metric}</p>
        <span>{evidence.status}</span>
      </div>
      <p className="dbti-evidence-description">{evidence.description}</p>
      <SourceLink source={evidence.source} />
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
    <p className="dbti-grounded-summary">
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
            {references.length ? <sup className="ml-1 whitespace-nowrap">{references.map((citation, referenceIndex) => <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer" aria-label={`Citation ${citation.position}: ${citation.title}`} className="dbti-citation">[{citation.position}{referenceIndex < references.length - 1 ? "," : ""}]</a>)}</sup> : null}
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
  const safeSearchSuggestionHtml = publicInformation.searchSuggestionHtml
    ? DOMPurify.sanitize(publicInformation.searchSuggestionHtml, {
      ALLOWED_TAGS: ["a", "div", "span", "p", "ul", "ol", "li", "br", "strong", "em"],
      ALLOWED_ATTR: ["href", "class", "aria-label", "role"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    })
    : undefined;

  return (
    <article className="dbti-public-web" aria-labelledby="google-public-information-title">
      <header className="dbti-public-web-head">
        <div>
          <p className="dbti-overline">Google public information</p>
          <h3 id="google-public-information-title">Public web findings</h3>
          {publicInformation.searchQuery ? <p className="dbti-query">Query: <span>{publicInformation.searchQuery}</span></p> : null}
        </div>
        <Badge variant="outline" className="dbti-provider-badge">
          {publicInformation.status === "AVAILABLE" ? (publicInformation.provider === "GOOGLE_SEARCH" ? "Google Search-grounded" : "Public-web search") : "Unavailable"}
        </Badge>
      </header>

      {publicInformation.searchUrl ? <a href={publicInformation.searchUrl} target="_blank" rel="noreferrer" className="dbti-search-link">Open this Google search <ArrowUpRight className="size-3.5" aria-hidden="true" /></a> : null}
      {publicInformation.status === "AVAILABLE" && publicInformation.summary ? (
        <>
          <GroundedSummary result={result} />
          <p className="dbti-public-boundary">This source-cited public-information supplement does not affect the deterministic DBTI score.</p>
          <div className="dbti-citation-list">
            <p className="dbti-overline">Sources cited by {publicInformation.provider === "GOOGLE_SEARCH" ? "Google Search" : "public-web search"}</p>
            <ul>
              {publicInformation.citations.map((citation) => (
                <li key={citation.id}>
                  <a href={citation.url} target="_blank" rel="noreferrer">{citation.title} <ExternalLink className="size-3" aria-hidden="true" /></a>
                </li>
              ))}
            </ul>
          </div>
          {safeSearchSuggestionHtml ? <div className="google-search-suggestions dbti-search-suggestions" aria-label="Google Search suggestions" dangerouslySetInnerHTML={{ __html: safeSearchSuggestionHtml }} /> : null}
        </>
      ) : (
        <p className="dbti-public-unavailable">{publicInformation.statusMessage} {protectedSite ? "No deterministic score is shown because first-party website content was not available." : "The website-only evidence and deterministic score remain available."}</p>
      )}
      {publicInformation.screenshotDataUrl ? <figure className="dbti-user-screenshot"><figcaption className="dbti-overline">Google results screenshot supplied from the user’s browser</figcaption><p>Submitted {publicInformation.screenshotSubmittedAt ? new Date(publicInformation.screenshotSubmittedAt).toLocaleString() : "without a recorded timestamp"}. This screenshot is user-provided and does not affect the deterministic DBTI score.</p><img src={publicInformation.screenshotDataUrl} alt={`Google search results for ${publicInformation.searchQuery ?? result.business.name}`} /></figure> : null}
    </article>
  );
}

export function DBTIResults({ result, onNewScan }: { result: DBTIResult; onNewScan: () => void }) {
  const [view, setView] = useState<ViewMode>("customer");
  const ownerMode = view === "owner";
  const protectedSite = result.scanMode === "PUBLIC_SEARCH_ONLY";
  const assistedSite = result.scanMode === "ASSISTED_EVIDENCE";
  const factorData = result.factors.map((factor) => ({ name: factor.name.replace(" ", "\n"), score: factor.score, contribution: factor.weightedContribution }));
  const scorePercent = result.dbtiScore ? Math.min(100, Math.max(0, result.dbtiScore / 10)) : 0;
  const scoreStyle = { "--score-angle": `${scorePercent * 3.6}deg` } as React.CSSProperties;

  return (
    <main className="dbti-shell dbti-results-shell dbti-redesigned-results pb-32" id="results">
      <div className="dbti-results-frame">
        <header className="dbti-report-masthead">
          <div className="dbti-report-topline">
            <span><span className="dbti-live-dot" aria-hidden="true" /> DBTI / ANALYSIS COMPLETE</span>
            <span>Evidence-led intelligence <span aria-hidden="true">↗</span></span>
          </div>
          <div className="dbti-report-headline">
            <div>
              <p className="dbti-report-label">Digital Business Trust Index</p>
              <h1>{result.business.name}</h1>
              <a href={result.business.website} target="_blank" rel="noreferrer">{result.business.domain} <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
            </div>
            <div className="dbti-report-actions">
              <div className="dbti-view-switch" aria-label="Select analysis detail view">
                <Button variant="ghost" size="sm" onClick={() => setView("customer")} aria-pressed={view === "customer"} className={view === "customer" ? "dbti-view-button active" : "dbti-view-button"}>Customer</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("owner")} aria-pressed={view === "owner"} className={view === "owner" ? "dbti-view-button active" : "dbti-view-button"}>Business owner</Button>
              </div>
              <Button variant="outline" onClick={onNewScan} className="dbti-new-scan">New scan <ArrowUpRight className="size-3.5" aria-hidden="true" /></Button>
            </div>
          </div>
          <div className="dbti-report-baseline" aria-hidden="true"><span /><span /><span /></div>
        </header>

        <section className="dbti-report-section" aria-labelledby="public-information-title">
          <SectionTitle id="public-information-title" index="01" title="Public Information" description="Website evidence is shown alongside separately attributed Google public information when source-grounded findings are available." />
          {protectedSite ? <div className="dbti-status-notice" role="status"><p className="dbti-overline">First-party website evidence unavailable</p><p>The site refused DBTI server-side collection. This report uses public-search findings only where Google Search grounding returned cited sources; it does not claim to have scanned the protected website and does not calculate a DBTI score.</p></div> : null}
          {assistedSite && result.userProvidedEvidence ? <div className="dbti-status-notice" role="status"><p className="dbti-overline">User-provided public evidence</p><p>DBTI analyzed visible text pasted by you from <a href={result.userProvidedEvidence.sourceUrl} target="_blank" rel="noreferrer">{result.userProvidedEvidence.sourceUrl}</a>. DBTI did not fetch this page from its server. The score uses only this submitted evidence and should be read as an assisted report.</p></div> : null}
          <div className="dbti-fact-grid">
            <div className="dbti-fact"><p className="data-label">Website</p><a href={result.publicInformation.website} className="data-value link-value" target="_blank" rel="noreferrer">{result.publicInformation.website}</a></div>
            <div className="dbti-fact"><p className="data-label">Industry</p><p className="data-value">{result.classification.industry}</p><p className="dbti-fact-note">{result.classification.confidence ? `${result.classification.confidence}% classification confidence` : "Insufficient public data"}</p></div>
            <div className="dbti-fact"><p className="data-label">Contact</p><p className="data-value">{result.publicInformation.contactEmail ?? result.publicInformation.contactPhone ?? "Unable to verify"}</p></div>
            <div className="dbti-fact"><p className="data-label">Verification signals</p><p className="data-value">{result.publicInformation.verificationSignals.length ? result.publicInformation.verificationSignals.join(", ") : "Unable to verify"}</p></div>
            {result.publicInformation.description ? <div className="dbti-fact dbti-fact-description"><p className="data-label">Description</p><p className="data-value">{result.publicInformation.description}</p></div> : null}
          </div>
          <GooglePublicInformationCard result={result} />
        </section>

        <section className="dbti-report-section" aria-labelledby="score-title">
          <SectionTitle id="score-title" index="02" title="DBTI Score" description={protectedSite ? "A numerical score requires collected first-party website evidence." : assistedSite ? "A reproducible calculation based only on the visible evidence you submitted." : "A reproducible weighted calculation based on the observed evidence."} />
          <div className="dbti-score-stage">
            <div className="dbti-score-visual" style={scoreStyle}>
              <div className="dbti-score-ring" aria-hidden="true" />
              <div className="dbti-score-center"><span>{result.dbtiScore ?? "—"}</span><small>{protectedSite ? "not calculated" : "out of 1000"}</small></div>
            </div>
            <div className="dbti-score-reading">
              <div className="dbti-score-kicker"><Activity className="size-4" aria-hidden="true" /> Current trust reading</div>
              <div className="dbti-score-stats">
                <div><p className="data-label">Grade</p><strong>{result.grade === "UNAVAILABLE" ? "—" : result.grade}</strong></div>
                <div><p className="data-label">Trust status</p><strong>{result.trustStatus}</strong></div>
                <div><p className="data-label">Scanned</p><strong>{new Date(result.scanTimestamp).toLocaleString()}</strong></div>
              </div>
              <p className="dbti-score-explanation">{result.explanation}</p>
            </div>
          </div>
        </section>

        <section className="dbti-report-section" aria-labelledby="breakdown-title">
          <SectionTitle id="breakdown-title" index="03" title="Score Breakdown" description="Expand a factor to see its collected evidence and its deterministic contribution." />
          {result.factors.length ? <div className="dbti-factor-list">{result.factors.map((factor) => <FactorDetail key={factor.key} factor={factor} ownerMode={ownerMode} />)}</div> : <p className="dbti-empty-note">No factor scores were calculated because first-party website evidence was unavailable.</p>}
        </section>

        <section className="dbti-report-section" aria-labelledby="charts-title">
          <SectionTitle id="charts-title" index="04" title="Interactive Charts" description="Visualizations are calculated directly from this scan’s factor scores." />
          {factorData.length ? <div className="dbti-chart-grid">
            <div className="dbti-chart-panel"><div className="dbti-chart-head"><p className="dbti-overline">Signal shape</p><span>01 / RADAR</span></div><ResponsiveContainer width="100%" height="88%"><RadarChart data={factorData}><PolarGrid stroke="var(--secondary)" /><PolarAngleAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="score" stroke="var(--foreground)" fill="var(--primary)" fillOpacity={0.42} /></RadarChart></ResponsiveContainer></div>
            <div className="dbti-chart-panel"><div className="dbti-chart-head"><p className="dbti-overline">Weighted contribution</p><span>02 / WEIGHT</span></div><ResponsiveContainer width="100%" height="88%"><BarChart data={factorData} margin={{ top: 16, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="var(--secondary)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval={0} /><YAxis tick={{ fill: "var(--foreground)", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--secondary)", color: "var(--foreground)" }} cursor={{ fill: "var(--background)" }} /><Bar dataKey="contribution" radius={0}>{factorData.map((factor) => <Cell key={factor.name} fill="var(--secondary)" />)}</Bar></BarChart></ResponsiveContainer></div>
          </div> : <p className="dbti-empty-note">Charts are unavailable until first-party website evidence can be collected.</p>}
        </section>

        <section className="dbti-report-section" aria-labelledby="evidence-title">
          <SectionTitle id="evidence-title" index="05" title="Evidence" description="Every visible finding records the observed source and evidence status." />
          {ownerMode ? <div className="dbti-evidence-ledger">{result.evidence.map((item) => <EvidenceRow evidence={item} key={item.id} />)}</div> : <p className="dbti-empty-note">Switch to Business owner view to inspect the complete evidence ledger.</p>}
        </section>

        <section className="dbti-report-section" aria-labelledby="strengths-title">
          <SectionTitle id="strengths-title" index="06" title="Strengths" />
          <div className="dbti-signal-grid">{result.strengths.map((factor, index) => <div key={factor.key} className="dbti-signal-card dbti-signal-positive"><div className="dbti-signal-topline"><span>0{index + 1} / VERIFIED</span><ShieldCheck className="size-4" aria-hidden="true" /></div><p>{factor.name}</p><span>{factor.keyFinding}</span></div>)}</div>
        </section>

        <section className="dbti-report-section" aria-labelledby="weaknesses-title">
          <SectionTitle id="weaknesses-title" index="07" title="Weaknesses" />
          <div className="dbti-signal-grid">{result.weaknesses.map((factor, index) => <div key={factor.key} className="dbti-signal-card dbti-signal-warning"><div className="dbti-signal-topline"><span>0{index + 1} / ATTENTION</span><ShieldAlert className="size-4" aria-hidden="true" /></div><p>{factor.name}</p><span>{factor.keyFinding}</span></div>)}</div>
        </section>

        <section className="dbti-report-section" aria-labelledby="recommendations-title">
          <SectionTitle id="recommendations-title" index="08" title="Recommendations" description="AI insights are shown only after evidence validation; otherwise DBTI provides deterministic recommendations tied to observed evidence." />
          <p className="dbti-ai-status" role="status"><Sparkles className="size-4" aria-hidden="true" /> {result.aiStatusMessage}</p>
          {result.recommendations.length ? <div className="dbti-recommendation-list">{result.recommendations.map((recommendation, index) => <article key={recommendation.title} className="dbti-recommendation"><span className="dbti-recommendation-index">0{index + 1}</span><div><p className="dbti-recommendation-priority">{recommendation.priority} priority</p><h3>{recommendation.title}</h3><p className="dbti-recommendation-reason">{recommendation.reason}</p><p className="dbti-recommendation-action">{recommendation.suggestedAction}</p></div><ArrowUpRight className="dbti-recommendation-arrow size-4" aria-hidden="true" /></article>)}</div> : <p className="dbti-empty-note">No verified failures or partial signals were available to support a recommendation in this scan.</p>}
        </section>

        <section className="dbti-report-section dbti-assistant-section" aria-labelledby="assistant-title">
          <SectionTitle id="assistant-title" index="09" title="DBTI Assistant" description="Open the floating assistant to ask about this specific scan." />
          <div className="dbti-assistant-brief"><div className="dbti-assistant-icon"><Sparkles className="size-5" aria-hidden="true" /></div><p>The assistant is constrained to verified evidence from the current scan. {result.aiAvailable ? "Gemini was available for scan-level interpretation." : "Gemini was not available for validated scan-level interpretation; the assistant will not fabricate a response."} When supporting evidence is insufficient, it responds: “I don&apos;t have enough verified data”.</p></div>
        </section>
        <DBTIAssistant result={result} />
      </div>
    </main>
  );
}
