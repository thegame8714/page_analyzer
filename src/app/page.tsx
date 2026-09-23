"use client";

import { FormEvent, useState } from "react";
import { AnalysisReport, FunnelMode } from "@/lib/analyze/types";
import { AnalysisError, normalizeUrl } from "@/lib/analyze/normalizeUrl";
import { ScoreGauge } from "@/components/ScoreGauge";
import { CategoryCard } from "@/components/CategoryCard";
import { Legend } from "@/components/Legend";
import { Blueprint } from "@/components/Blueprint";
import { FunnelFlow } from "@/components/FunnelFlow";

const BENCHMARKS = [
  "Hormozi · $100M Offers",
  "Brunson · Expert Secrets",
  "StoryBrand SB7",
  "Cialdini · Influence",
  "FTC Endorsement Guides",
  "EU Omnibus / GDPR",
  "Google E-E-A-T & Core Web Vitals",
  "GEO (AI search)",
  "Free-call funnel leaders",
];

const MODES: { value: FunnelMode; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "call", label: "Free call / application" },
  { value: "checkout", label: "Direct purchase" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<FunnelMode>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    // Every check starts from a clean slate — a prior report (or error)
    // must never linger once a new analysis is requested, even if this
    // attempt fails validation before a request is even sent.
    setReport(null);
    setError(null);

    let normalized: string;
    try {
      normalized = normalizeUrl(url);
    } catch (err) {
      setError(err instanceof AnalysisError ? err.message : "That doesn't look like a valid URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setReport(data as AnalysisReport);
    } catch {
      setError("Network error — could not reach the analysis server.");
    } finally {
      setLoading(false);
    }
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    if (error) setError(null);
  }

  const hasResult = Boolean(report || loading);

  const errorBox = error && (
    <div className="mb-4 max-w-xl mx-auto rounded-xl border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
      {error}
    </div>
  );

  const form = (autoFocus: boolean) => (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          autoFocus={autoFocus}
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://yourcoaching.com/program"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      <fieldset className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <legend className="sr-only">Funnel type</legend>
        <span className="text-slate-500">Funnel:</span>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`cursor-pointer rounded-full border px-3 py-1 transition ${
              mode === m.value
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="sr-only"
            />
            {m.label}
          </label>
        ))}
      </fieldset>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        {!hasResult ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
              Coaching Sales Page Analyzer
            </h1>
            <p className="mt-3 max-w-xl text-center text-sm text-slate-400">
              Paste the sales page of an online coaching program, whether it sells the program
              directly or books a free call. We follow the CTA to the next step and check the
              offer, structure, proof, booking flow, SEO, GEO, clarity and grammar against the
              standards the top coaching businesses follow.
            </p>
            <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {BENCHMARKS.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400"
                >
                  {b}
                </span>
              ))}
            </div>
            <div className="mt-8 w-full max-w-xl">
              {errorBox}
              {form(true)}
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-xl mx-auto">
              <h1 className="mb-6 text-xl font-bold tracking-tight text-center">
                Coaching Sales Page Analyzer
              </h1>
              {errorBox}
              {form(false)}
            </div>

            {loading && !report && (
              <div className="mt-12 flex flex-col items-center gap-3 text-slate-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
                <p className="text-sm">
                  Fetching the page, following the CTA to the next step, and checking the
                  offer, structure, proof, booking flow, SEO, GEO, clarity and grammar…
                </p>
              </div>
            )}

            {report && (
              <div className="mt-12 space-y-8">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col sm:flex-row items-center gap-6">
                  <ScoreGauge score={report.overallScore} size={120} strokeWidth={10} />
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-slate-400">Overall coaching sales-page score</p>
                    <p className="text-2xl font-bold text-slate-100">
                      Grade {report.overallGrade} · {report.overallScore}/100
                    </p>
                    <p className="mt-1 text-sm text-slate-500 break-all">{report.finalUrl}</p>
                  </div>
                </div>

                {report.topRecommendations.length > 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    <h2 className="text-lg font-semibold text-slate-100">
                      Top recommendations
                    </h2>
                    <ol className="mt-3 space-y-2 list-decimal list-inside text-sm text-slate-300">
                      {report.topRecommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <FunnelFlow funnel={report.funnel} />

                {report.blueprint.length > 0 && (
                  <Blueprint
                    sections={report.blueprint}
                    title={report.funnel.type === "call" ? "Free-call page blueprint" : "Coaching sales-page blueprint"}
                  />
                )}

                <Legend />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {report.categories.map((c) => (
                    <CategoryCard key={`${report.fetchedAt}-${c.key}`} category={c} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
