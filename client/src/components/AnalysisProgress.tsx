import { Loader2, ShieldCheck } from "lucide-react";

export function AnalysisProgress({ query }: { query: string }) {
  return (
    <section className="mx-auto mt-12 max-w-xl border-y border-[#262626] py-7 text-left" aria-live="polite" aria-label="Analysis in progress">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-full border border-[#262626] bg-[#111111]">
          <Loader2 className="size-4 animate-spin text-[#F5F5F5]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium tracking-wide text-[#F5F5F5]">Analyzing public evidence</p>
          <p className="mt-1 text-sm leading-6 text-[#A1A1A1]">
            DBTI is collecting bounded public website evidence and calculating the score for <span className="text-[#F5F5F5]">{query}</span>.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          "Public website collection",
          "Evidence extraction",
          "Deterministic scoring",
        ].map((step) => (
          <div key={step} className="flex items-center gap-2 text-xs text-[#A1A1A1]">
            <ShieldCheck className="size-3.5 text-[#A1A1A1]" aria-hidden="true" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
