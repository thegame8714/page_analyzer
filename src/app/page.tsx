"use client";

import { FormEvent, useState } from "react";
import { AnalysisReport } from "@/lib/analyze/types";
import { AnalysisError, normalizeUrl } from "@/lib/analyze/normalizeUrl";
import { ScoreGauge } from "@/components/ScoreGauge";
import { CategoryCard } from "@/components/CategoryCard";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    let normalized: string;
    try {
      normalized = normalizeUrl(url);
    } catch (err) {
      setError(err instanceof AnalysisError ? err.message : "That doesn't look like a valid URL.");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        {!hasResult ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
              Landing Page Analyzer
            </h1>
            <div className="mt-8 w-full max-w-xl">
              {errorBox}
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  autoFocus
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Analyze
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-xl mx-auto">
              {errorBox}
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Analyzing…" : "Analyze"}
                </button>
              </form>
            </div>

            {loading && !report && (
              <div className="mt-12 flex flex-col items-center gap-3 text-slate-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
                <p className="text-sm">
                  Fetching the page and running SEO, GEO, clarity, grammar, and conversion
                  checks…
                </p>
              </div>
            )}

            {report && (
              <div className="mt-12 space-y-8">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col sm:flex-row items-center gap-6">
                  <ScoreGauge score={report.overallScore} size={120} strokeWidth={10} />
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-slate-400">Overall conversion readiness score</p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {report.categories.map((c) => (
                    <CategoryCard key={c.key} category={c} />
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
