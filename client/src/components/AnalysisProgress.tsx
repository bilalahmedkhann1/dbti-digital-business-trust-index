import { Loader2, ShieldCheck } from "lucide-react";

export function AnalysisProgress({ query }: { query: string }) {
  return (
    <section className="mx-auto mt-12 max-w-xl border-y border-[var(--border)] py-7 text-left" aria-live="polite" aria-label="Analysis in progress">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]">
          <Loader2 className="size-4 animate-spin text-[var(--foreground)]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium tracking-wide text-[var(--foreground)]">Analyzing public evidence</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            DBTI is collecting bounded public website evidence and calculating the score for <span className="text-[var(--foreground)]">{query}</span>.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          "Public website collection",
          "Evidence extraction",
          "Deterministic scoring",
        ].map((step) => (
          <div key={step} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <ShieldCheck className="size-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
