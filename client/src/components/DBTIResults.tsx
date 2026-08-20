import { DBTIAssistant } from "@/components/DBTIAssistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DBTIResult, Evidence, FactorScore } from "@shared/dbti";
import { ChevronDown, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
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
    <header className="mb-6 flex flex-col gap-2 border-t border-[#262626] pt-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs tracking-[0.18em] text-[#A1A1A1]">{index}</p>
        <h2 className="mt-1 text-xl font-medium tracking-[-0.03em] text-[#F5F5F5]">{title}</h2>
      </div>
      {description ? <p className="max-w-md text-sm leading-6 text-[#A1A1A1]">{description}</p> : null}
    </header>
  );
}

function SourceLink({ source }: { source: string }) {
  return (
    <a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#A1A1A1] underline-offset-4 hover:text-[#F5F5F5] hover:underline">
      Source <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function FactorDetail({ factor, ownerMode }: { factor: FactorScore; ownerMode: boolean }) {
  return (
    <details className="group border-b border-[#262626] py-4">
      <summary className="flex cursor-pointer list-none items-center gap-4 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#F5F5F5] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0B0B0B]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#F5F5F5]">{factor.name}</p>
          <p className="mt-1 truncate text-xs text-[#A1A1A1]">{factor.keyFinding}</p>
        </div>
        <Badge variant="outline" className="border-[#262626] bg-transparent text-xs font-normal text-[#A1A1A1]">{STATUS_LABELS[factor.status]}</Badge>
        <p className="w-12 text-right text-lg font-medium tabular-nums text-[#F5F5F5]">{factor.score}</p>
        <ChevronDown className="size-4 shrink-0 text-[#A1A1A1] transition duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 pt-5 md:grid-cols-[140px_1fr]">
        <div className="text-xs leading-5 text-[#A1A1A1]">
          Weight {factor.weight}%<br />
          Contribution {factor.weightedContribution}/100<br />
          Evidence coverage {Math.round(factor.coverage * 100)}%
        </div>
        {ownerMode ? (
          <div className="space-y-3">
            {factor.metrics.map((item) => <EvidenceRow key={`${factor.key}-${item.id}`} evidence={item} />)}
          </div>
        ) : (
          <p className="text-sm leading-6 text-[#A1A1A1]">Switch to Business owner view to inspect the collected metric-level evidence.</p>
        )}
      </div>
    </details>
  );
}

function EvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <div className="rounded-lg bg-[#171717] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#F5F5F5]">{evidence.metric}</p>
        <span className="font-mono text-[11px] text-[#A1A1A1]">{evidence.status}</span>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-[#A1A1A1]">{evidence.description}</p>
      <div className="mt-2"><SourceLink source={evidence.source} /></div>
    </div>
  );
}

export function DBTIResults({ result, onNewScan }: { result: DBTIResult; onNewScan: () => void }) {
  const [view, setView] = useState<ViewMode>("customer");
  const ownerMode = view === "owner";
  const factorData = result.factors.map((factor) => ({ name: factor.name.replace(" ", "\n"), score: factor.score, contribution: factor.weightedContribution }));

  return (
    <main className="pb-32" id="results">
      <div className="flex flex-col gap-5 border-b border-[#262626] py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-[#A1A1A1]">ANALYSIS COMPLETE</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-[#F5F5F5]">{result.business.name}</h1>
          <a className="mt-1 inline-block text-sm text-[#A1A1A1] hover:text-[#F5F5F5]" href={result.business.website} target="_blank" rel="noreferrer">{result.business.domain}</a>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-[#262626] bg-[#111111] p-1" aria-label="Select analysis detail view">
            <Button variant="ghost" size="sm" onClick={() => setView("customer")} aria-pressed={view === "customer"} className={view === "customer" ? "rounded-full bg-[#262626] text-[#F5F5F5] hover:bg-[#262626] hover:text-[#F5F5F5]" : "rounded-full text-[#A1A1A1] hover:bg-transparent hover:text-[#F5F5F5]"}>Customer</Button>
            <Button variant="ghost" size="sm" onClick={() => setView("owner")} aria-pressed={view === "owner"} className={view === "owner" ? "rounded-full bg-[#262626] text-[#F5F5F5] hover:bg-[#262626] hover:text-[#F5F5F5]" : "rounded-full text-[#A1A1A1] hover:bg-transparent hover:text-[#F5F5F5]"}>Business owner</Button>
          </div>
          <Button variant="outline" onClick={onNewScan} className="border-[#262626] text-[#F5F5F5] hover:bg-[#171717] hover:text-[#F5F5F5]">New scan</Button>
        </div>
      </div>

      <section className="py-12" aria-labelledby="public-information-title">
        <SectionTitle index="01" title="Public Information" description="Only information collected from the scanned public pages is shown." />
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <div><p className="data-label">Website</p><a href={result.publicInformation.website} className="data-value link-value" target="_blank" rel="noreferrer">{result.publicInformation.website}</a></div>
          <div><p className="data-label">Industry</p><p className="data-value">{result.classification.industry}</p><p className="mt-1 text-xs text-[#A1A1A1]">{result.classification.confidence ? `${result.classification.confidence}% classification confidence` : "Insufficient public data"}</p></div>
          <div><p className="data-label">Contact</p><p className="data-value">{result.publicInformation.contactEmail ?? result.publicInformation.contactPhone ?? "Unable to verify"}</p></div>
          <div><p className="data-label">Verification signals</p><p className="data-value">{result.publicInformation.verificationSignals.length ? result.publicInformation.verificationSignals.join(", ") : "Unable to verify"}</p></div>
          {result.publicInformation.description ? <div className="md:col-span-2"><p className="data-label">Description</p><p className="max-w-3xl text-sm leading-7 text-[#A1A1A1]">{result.publicInformation.description}</p></div> : null}
        </div>
      </section>

      <section className="py-12" aria-labelledby="score-title">
        <SectionTitle index="02" title="DBTI Score" description="A reproducible weighted calculation based on the observed evidence." />
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="border-l border-[#F5F5F5] pl-6">
            <p className="text-7xl font-medium leading-none tracking-[-0.08em] text-[#F5F5F5] sm:text-8xl">{result.dbtiScore}</p>
            <p className="mt-3 text-sm text-[#A1A1A1]">out of 1000</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div><p className="data-label">Grade</p><p className="mt-2 text-3xl font-medium text-[#F5F5F5]">{result.grade}</p></div>
            <div><p className="data-label">Trust status</p><p className="mt-2 text-lg text-[#F5F5F5]">{result.trustStatus}</p></div>
            <div><p className="data-label">Scanned</p><p className="mt-2 text-sm leading-6 text-[#F5F5F5]">{new Date(result.scanTimestamp).toLocaleString()}</p></div>
          </div>
        </div>
        <p className="mt-10 max-w-3xl text-base leading-7 text-[#A1A1A1]">{result.explanation}</p>
      </section>

      <section className="py-12" aria-labelledby="breakdown-title">
        <SectionTitle index="03" title="Score Breakdown" description="Expand a factor to see its collected evidence and its deterministic contribution." />
        <div>{result.factors.map((factor) => <FactorDetail key={factor.key} factor={factor} ownerMode={ownerMode} />)}</div>
      </section>

      <section className="py-12" aria-labelledby="charts-title">
        <SectionTitle index="04" title="Interactive Charts" description="Visualizations are calculated directly from this scan's factor scores." />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[320px] border border-[#262626] bg-[#111111] p-4"><p className="data-label">Factor radar</p><ResponsiveContainer width="100%" height="92%"><RadarChart data={factorData}><PolarGrid stroke="#262626" /><PolarAngleAxis dataKey="name" tick={{ fill: "#A1A1A1", fontSize: 10 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="score" stroke="#F5F5F5" fill="#F5F5F5" fillOpacity={0.14} /></RadarChart></ResponsiveContainer></div>
          <div className="h-[320px] border border-[#262626] bg-[#111111] p-4"><p className="data-label">Weighted contribution</p><ResponsiveContainer width="100%" height="92%"><BarChart data={factorData} margin={{ top: 16, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="#262626" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#A1A1A1", fontSize: 10 }} tickLine={false} axisLine={false} interval={0} /><YAxis tick={{ fill: "#A1A1A1", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#171717", border: "1px solid #262626", color: "#F5F5F5" }} cursor={{ fill: "#171717" }} /><Bar dataKey="contribution" radius={0}>{factorData.map((factor) => <Cell key={factor.name} fill="#F5F5F5" />)}</Bar></BarChart></ResponsiveContainer></div>
        </div>
      </section>

      <section className="py-12" aria-labelledby="evidence-title">
        <SectionTitle index="05" title="Evidence" description="Every visible finding records the observed source and evidence status." />
        {ownerMode ? <div className="grid gap-3 md:grid-cols-2">{result.evidence.map((item) => <EvidenceRow evidence={item} key={item.id} />)}</div> : <p className="text-sm leading-6 text-[#A1A1A1]">Switch to Business owner view to inspect the complete evidence ledger.</p>}
      </section>

      <section className="py-12" aria-labelledby="strengths-title">
        <SectionTitle index="06" title="Strengths" />
        <div className="grid gap-3 md:grid-cols-3">{result.strengths.map((factor) => <div key={factor.key} className="border border-[#262626] bg-[#111111] p-5"><ShieldCheck className="size-4 text-[#F5F5F5]" aria-hidden="true" /><p className="mt-6 text-lg text-[#F5F5F5]">{factor.name}</p><p className="mt-2 text-sm leading-6 text-[#A1A1A1]">{factor.keyFinding}</p></div>)}</div>
      </section>

      <section className="py-12" aria-labelledby="weaknesses-title">
        <SectionTitle index="07" title="Weaknesses" />
        <div className="grid gap-3 md:grid-cols-3">{result.weaknesses.map((factor) => <div key={factor.key} className="border border-[#262626] bg-[#111111] p-5"><ShieldAlert className="size-4 text-[#F5F5F5]" aria-hidden="true" /><p className="mt-6 text-lg text-[#F5F5F5]">{factor.name}</p><p className="mt-2 text-sm leading-6 text-[#A1A1A1]">{factor.keyFinding}</p></div>)}</div>
      </section>

      <section className="py-12" aria-labelledby="recommendations-title">
        <SectionTitle index="08" title="AI Recommendations" description="Recommendations only appear when the AI service can validate output against this scan's evidence." />
        {result.recommendations.length ? <div className="space-y-3">{result.recommendations.map((recommendation) => <article key={recommendation.title} className="border border-[#262626] bg-[#111111] p-5"><p className="text-xs tracking-[0.12em] text-[#A1A1A1]">{recommendation.priority} PRIORITY</p><h3 className="mt-3 text-lg text-[#F5F5F5]">{recommendation.title}</h3><p className="mt-2 text-sm leading-6 text-[#A1A1A1]">{recommendation.reason}</p></article>)}</div> : <p className="text-sm leading-6 text-[#A1A1A1]">AI recommendations are unavailable until a server-side AI provider is configured. Your calculated score and evidence remain available.</p>}
      </section>

      <section className="py-12" aria-labelledby="assistant-title">
        <SectionTitle index="09" title="DBTI Assistant" description="Open the floating assistant to ask about this specific scan." />
        <p className="text-sm leading-6 text-[#A1A1A1]">The assistant is constrained to verified evidence from the current scan. When supporting evidence is insufficient, it responds: “I don&apos;t have enough verified data”.</p>
      </section>
      <DBTIAssistant result={result} />
    </main>
  );
}
