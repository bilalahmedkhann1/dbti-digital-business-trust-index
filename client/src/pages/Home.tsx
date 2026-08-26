import { AnalysisProgress } from "@/components/AnalysisProgress";
import { DBTIResults } from "@/components/DBTIResults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCESS_RESTRICTION_MESSAGE, isAccessRestrictionMessage } from "@/lib/collectionStatus";
import { trpc } from "@/lib/trpc";
import type { DBTIResult } from "@shared/dbti";
import { ArrowRight, ExternalLink, Search, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "wouter";
import React, { FormEvent, useEffect, useRef, useState } from "react";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<DBTIResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [accessRestricted, setAccessRestricted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("simulate_access_restricted")) {
      setMessage(ACCESS_RESTRICTION_MESSAGE);
      setAccessRestricted(true);
    }
  }, []);
  const analysis = trpc.analysis.scan.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setMessage(null);
      setAccessRestricted(false);
      window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
    onError: (error) => {
      setMessage(error.message);
      setAccessRestricted(isAccessRestrictionMessage(error.message));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submitted = query.trim();
    if (!submitted) {
      setMessage("Enter a public website or domain to begin an evidence-based scan.");
      return;
    }
    setResult(null);
    setMessage(null);
    setAccessRestricted(false);
    analysis.mutate({ query: submitted });
  };

  const reset = () => {
    setResult(null);
    setMessage(null);
    setAccessRestricted(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F5F5]">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <nav className="flex items-center gap-6" aria-label="Primary navigation">
          <Link href="/" className="mr-3 text-sm font-semibold tracking-[-0.04em] text-[#F5F5F5]">DBTI</Link>
          <Link href="/" className={`text-sm transition-colors ${location === "/" ? "text-[#F5F5F5]" : "text-[#A1A1A1] hover:text-[#F5F5F5]"}`}>Home</Link>
          <Link href="/dashboard" className={`text-sm transition-colors ${location === "/dashboard" ? "text-[#F5F5F5]" : "text-[#A1A1A1] hover:text-[#F5F5F5]"}`}>Dashboard</Link>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {!result ? (
          <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center pb-20 text-center">
            <p className="text-xs tracking-[0.22em] text-[#A1A1A1]">DIGITAL BUSINESS TRUST INDEX</p>
            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-medium tracking-[-0.055em] text-[#F5F5F5] sm:text-6xl">Evidence before opinion.</h1>
            <p className="mt-5 max-w-xl text-balance text-sm leading-7 text-[#A1A1A1] sm:text-base">Analyze a public website through a bounded evidence collection process and a deterministic trust-scoring methodology.</p>
            <form onSubmit={submit} className="mt-10 flex w-full max-w-2xl items-center rounded-full border border-[#262626] bg-[#F5F5F5] p-1.5 shadow-[0_18px_50px_rgba(11,11,11,0.72)]">
              <Search className="ml-4 size-5 shrink-0 text-[#0B0B0B]" aria-hidden="true" />
              <label className="sr-only" htmlFor="business-search">Search a business or website</label>
              <Input ref={inputRef} id="business-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a business or website" disabled={analysis.isPending} className="h-12 border-0 !bg-[#FFFFFF] px-3 text-base text-[#0B0B0B] placeholder:text-[#262626] focus-visible:ring-0" />
              <Button type="submit" disabled={analysis.isPending} className="size-12 shrink-0 rounded-full bg-[#007AFF] text-[#FFFFFF] hover:bg-[#5856D6] hover:text-[#FFFFFF]" aria-label="Analyze website">
                <ArrowRight className="size-5" />
              </Button>
            </form>
            {message && !accessRestricted ? <p className="mt-4 max-w-xl text-sm leading-6 text-[#A1A1A1]" role="alert">{message}</p> : null}
            {accessRestricted ? (
              <section className="mt-5 w-full max-w-2xl border border-[#262626] bg-[#111111] p-5 text-left" role="alert" aria-labelledby="access-restriction-title">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#A1A1A1]" aria-hidden="true" />
                  <div>
                    <p id="access-restriction-title" className="text-sm font-medium text-[#F5F5F5]">This website blocks server-side scanning</p>
                    <p className="mt-2 text-sm leading-6 text-[#A1A1A1]">DBTI received an HTTP 403 response from this website. The site may work normally in your browser, but its owner has chosen not to allow automated collection from this server. DBTI will not bypass that control.</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button type="button" variant="outline" onClick={() => { setAccessRestricted(false); setMessage("Paste a different publicly accessible page from this website, such as an About, Contact, or product page, then scan it."); inputRef.current?.focus(); }} className="border-[#262626] text-[#F5F5F5] hover:bg-[#171717] hover:text-[#F5F5F5]">
                        Try a public page <ExternalLink className="ml-2 size-3.5" aria-hidden="true" />
                      </Button>
                      <p className="text-xs leading-5 text-[#A1A1A1]">If every public page is blocked, ask the website owner to permit standard public requests or use the visible page evidence manually.</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
            {analysis.isPending ? <AnalysisProgress query={query} /> : null}
          </main>
        ) : <DBTIResults result={result} onNewScan={reset} />}
      </div>
    </div>
  );
}
