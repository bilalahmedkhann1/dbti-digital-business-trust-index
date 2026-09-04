import { AnalysisProgress } from "@/components/AnalysisProgress";
import { DBTIResults } from "@/components/DBTIResults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACCESS_RESTRICTION_MESSAGE, isAccessRestrictionMessage } from "@/lib/collectionStatus";
import { trpc } from "@/lib/trpc";
import { DEV_ASSISTED_RESULT, DEV_PREVIEW_RESULT, DEV_PROTECTED_RESULT } from "@/lib/devPreview";
import { useTheme } from "@/contexts/ThemeContext";
import type { DBTIResult } from "@shared/dbti";
import { Activity, ArrowRight, ArrowUpRight, ExternalLink, Search, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import React, { FormEvent, useEffect, useRef, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<DBTIResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [assistedContent, setAssistedContent] = useState("");
  const [assistedError, setAssistedError] = useState<string | null>(null);
  const [googleScreenshotDataUrl, setGoogleScreenshotDataUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/manus-storage/dbti-logo-light_d3f5013b.png" : "/manus-storage/dbti-logo-cropped_1470a17a.png";

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("preview_results") || params.has("preview_protected") || params.has("preview_assisted")) {
      setQuery("preview.dbti.example");
      setResult(params.has("preview_protected") ? DEV_PROTECTED_RESULT : params.has("preview_assisted") ? DEV_ASSISTED_RESULT : DEV_PREVIEW_RESULT);
      return;
    }
    if (params.has("simulate_access_restricted")) {
      setMessage(ACCESS_RESTRICTION_MESSAGE);
      setAccessRestricted(true);
    }
  }, []);

  const assistedAnalysis = trpc.analysis.assistedScan.useMutation({
    onSuccess: (data) => {
      setResult(data); setMessage(null); setAccessRestricted(false); setAssistedContent(""); setAssistedError(null); setGoogleScreenshotDataUrl("");
      window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
    onError: (error) => { setAssistedError(error.message); setMessage(error.message); },
  });
  const analysis = trpc.analysis.scan.useMutation({
    onSuccess: (data) => {
      setResult(data); setMessage(null); setAccessRestricted(false);
      window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
    onError: (error) => { setMessage(error.message); setAccessRestricted(isAccessRestrictionMessage(error.message)); },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submitted = query.trim();
    if (!submitted) { setMessage("Enter a public website or domain to begin an evidence-based scan."); return; }
    setResult(null); setMessage(null); setAccessRestricted(false); analysis.mutate({ query: submitted });
  };

  const openGoogleSearch = () => {
    try {
      const host = new URL(query.includes("://") ? query : `https://${query}`).hostname.replace(/^www\./, "");
      window.open(`https://www.google.com/search?q=${encodeURIComponent(`site:${host} ${host}`)}`, "_blank", "noopener,noreferrer");
    } catch { setMessage("Enter a valid public website before opening its Google search."); }
  };

  const reset = () => {
    setResult(null); setMessage(null); setAccessRestricted(false); setQuery(""); setGoogleScreenshotDataUrl("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="dbti-shell min-h-screen text-foreground">
      <div className="dbti-orbit" aria-hidden="true" />
      <header className="dbti-nav sticky top-0 z-20">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <nav className="flex items-center gap-6" aria-label="Primary navigation">
            <Link href="/" aria-label="DBTI home" className="mr-2 inline-flex items-center"><img src={logoSrc} alt="DBTI" className="h-8 w-auto object-contain" /></Link>
            <Link href="/" className={`text-sm transition-colors ${location === "/" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Home</Link>
            <Link href="/dashboard" className={`text-sm transition-colors ${location === "/dashboard" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Dashboard</Link>
          </nav>
          <div className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-[var(--secondary)]" /> Evidence-led intelligence</div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {!result ? (
          <main className="relative flex min-h-[calc(100vh-4.5rem)] flex-col justify-center pb-20 pt-12 lg:pt-4">
            <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--foreground)_18%,transparent)] bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"><Sparkles className="size-3.5 text-[var(--primary)]" aria-hidden="true" /> Digital Business Trust Index</div>
                <h1 className="max-w-3xl text-balance text-5xl font-medium leading-[0.98] tracking-[-0.07em] text-foreground sm:text-7xl lg:text-[6.6rem]">Evidence<br /><span className="dbti-accent-text">before opinion.</span></h1>
                <p className="mt-7 max-w-xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">Analyze a public website through bounded evidence collection, public-web citations, and a deterministic trust-scoring methodology.</p>
                <form onSubmit={submit} className="dbti-search mt-9 flex w-full max-w-2xl items-center rounded-full border p-1.5">
                  <Search className="ml-4 size-5 shrink-0 text-[var(--surface-foreground)]" aria-hidden="true" />
                  <label className="sr-only" htmlFor="business-search">Search a business or website</label>
                  <Input ref={inputRef} id="business-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a business or website" disabled={analysis.isPending} className="h-12 border-0 !bg-transparent px-3 text-base text-[var(--surface-foreground)] placeholder:text-[var(--surface-foreground)] focus-visible:ring-0" />
                  <Button type="submit" disabled={analysis.isPending} className="size-12 shrink-0 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]" aria-label="Analyze website"><ArrowRight className="size-5" /></Button>
                </form>
                {message && !accessRestricted ? <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground" role="alert">{message}</p> : null}
              </div>
              <aside className="dbti-hero-card hidden min-h-[22rem] overflow-hidden p-6 lg:block">
                <img src="/manus-storage/dbti-evidence-network_d410bc2d.png" alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full object-cover object-center opacity-30" />
                <div className="relative z-10 flex items-start justify-between"><span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Scan protocol / 001</span><ArrowUpRight className="size-4 text-[var(--primary)]" aria-hidden="true" /></div>
                <div className="relative z-10 mt-20"><p className="text-3xl font-medium tracking-[-0.05em] text-foreground">Measure what<br /><span className="dbti-accent-text">can be verified.</span></p><p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">First-party signals form the score. Public findings stay cited and separate.</p></div>
                <div className="relative z-10 mt-8 grid grid-cols-2 gap-3"><div className="dbti-mini-card p-3"><Activity className="size-4 text-[var(--primary)]" /><p className="mt-4 text-xs text-muted-foreground">10 weighted factors</p></div><div className="dbti-mini-card p-3"><ShieldCheck className="size-4 text-[var(--secondary)]" /><p className="mt-4 text-xs text-muted-foreground">Evidence ledger</p></div></div>
              </aside>
            </div>
            <div className="mt-16 grid max-w-3xl gap-3 border-t border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] pt-5 sm:grid-cols-3"><div><p className="data-label">01 / Collect</p><p className="mt-2 text-sm text-foreground">Bounded public pages</p></div><div><p className="data-label">02 / Score</p><p className="mt-2 text-sm text-foreground">Deterministic calculation</p></div><div><p className="data-label">03 / Explain</p><p className="mt-2 text-sm text-foreground">Cited public context</p></div></div>
            {accessRestricted ? (
              <section className="mt-8 w-full max-w-3xl border border-[var(--secondary)] bg-[color-mix(in_srgb,var(--card)_82%,transparent)] p-5 text-left shadow-[0_18px_60px_color-mix(in_srgb,var(--foreground)_12%,transparent)]" role="alert" aria-labelledby="access-restriction-title">
                <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-[var(--secondary)]" aria-hidden="true" /><div className="min-w-0"><p id="access-restriction-title" className="text-sm font-medium text-foreground">This website blocks server-side scanning</p><p className="mt-2 text-sm leading-6 text-muted-foreground">DBTI received an HTTP 403 response from this website. The site may work normally in your browser, but its owner has chosen not to allow automated collection from this server. DBTI will not bypass that control.</p><div className="mt-4"><label htmlFor="assisted-evidence" className="text-xs font-medium text-foreground">Paste visible public page text (free fallback)</label><Textarea id="assisted-evidence" value={assistedContent} onChange={(event) => { setAssistedContent(event.target.value); setAssistedError(null); }} placeholder="Open the page in your browser, copy its visible text, and paste it here…" className="mt-2 min-h-28 border-[var(--primary)] bg-background text-foreground placeholder:text-muted-foreground" disabled={assistedAnalysis.isPending} aria-describedby="assisted-evidence-help" /><p id="assisted-evidence-help" className="mt-2 text-xs leading-5 text-muted-foreground">Use at least 80 characters of visible, public page text. Do not paste passwords, private account data, or personal information.</p><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={openGoogleSearch} className="border-[var(--primary)] text-foreground hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]">Open Google search <ExternalLink className="ml-2 size-3.5" aria-hidden="true" /></Button><label className="text-xs text-muted-foreground">Attach Google results screenshot<input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block max-w-full text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-2 file:text-xs file:text-[var(--secondary-foreground)]" disabled={assistedAnalysis.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 3_000_000) { setAssistedError("Choose a screenshot smaller than 3 MB."); return; } const reader = new FileReader(); reader.onload = () => setGoogleScreenshotDataUrl(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }} /></label></div>{googleScreenshotDataUrl ? <p className="mt-2 text-xs text-[var(--secondary)]">Google results screenshot attached and will be shown in the report.</p> : null}{assistedError ? <p className="mt-2 text-sm leading-5 text-foreground" role="alert">{assistedError}</p> : null}<Button type="button" disabled={assistedAnalysis.isPending || assistedContent.trim().length < 80} onClick={() => assistedAnalysis.mutate({ query, content: assistedContent, ...(googleScreenshotDataUrl ? { googleScreenshotDataUrl } : {}) })} className="mt-3 bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]">Analyze pasted evidence</Button></div><Button type="button" variant="outline" onClick={() => { setAccessRestricted(false); setMessage("Paste a different publicly accessible page from this website, such as an About, Contact, or product page, then scan it."); inputRef.current?.focus(); }} className="mt-4 border-[var(--primary)] text-foreground hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]">Try a public page <ExternalLink className="ml-2 size-3.5" aria-hidden="true" /></Button><p className="mt-3 text-xs leading-5 text-muted-foreground">If every public page is blocked, ask the website owner to permit standard public requests or use the visible page evidence manually.</p></div></div>
              </section>
            ) : null}
            {analysis.isPending ? <AnalysisProgress query={query} /> : null}
          </main>
        ) : <DBTIResults result={result} onNewScan={reset} />}
      </div>
    </div>
  );
}
