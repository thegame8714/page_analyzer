"use client";

import { FormEvent, useState } from "react";
import { AnalysisReport, FunnelMode, Product, Text, tr } from "@/lib/analyze/types";
import { AnalysisError, normalizeUrl } from "@/lib/analyze/normalizeUrl";
import { ScoreGauge } from "@/components/ScoreGauge";
import { CategoryCard } from "@/components/CategoryCard";
import { Legend } from "@/components/Legend";
import { Blueprint } from "@/components/Blueprint";
import { FunnelFlow } from "@/components/FunnelFlow";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { DICTIONARIES } from "@/lib/i18n";

// Errors are kept as { en, it } so an on-screen error switches with the toggle.
const bothLanguages = (key: "networkError" | "genericError") => tr(DICTIONARIES.en[key], DICTIONARIES.it[key]);

const BENCHMARKS: Record<Product, Text[]> = {
  landing: [
    tr("Conversion readiness", "Predisposizione alla conversione"),
    "SEO",
    tr("GEO (AI search)", "GEO (ricerca AI)"),
    tr("Text clarity", "Chiarezza del testo"),
    tr("Content efficiency", "Efficienza dei contenuti"),
    tr("Grammar", "Grammatica"),
  ],
  coaching: [
    "Hormozi · $100M Offers",
    "Brunson · Expert Secrets",
    "StoryBrand SB7",
    tr("Cialdini · Influence", "Cialdini · Le armi della persuasione"),
    "FTC Endorsement Guides",
    tr("EU Omnibus / GDPR", "UE Omnibus / GDPR"),
    "Google E-E-A-T & Core Web Vitals",
    tr("GEO (AI search)", "GEO (ricerca AI)"),
    tr("Free-call funnel leaders", "Leader dei funnel a call gratuita"),
  ],
};

const PRODUCTS: Product[] = ["coaching", "landing"];
const MODES: FunnelMode[] = ["auto", "call", "checkout"];

function Pills<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  label,
}: {
  name: string;
  legend: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option}
          className={`cursor-pointer rounded-full border px-3 py-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500 ${
            value === option
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
              : "border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          {label(option)}
        </label>
      ))}
    </fieldset>
  );
}

export default function Home() {
  const { t, p } = useLanguage();
  const [url, setUrl] = useState("");
  const [product, setProduct] = useState<Product>("coaching");
  const [mode, setMode] = useState<FunnelMode>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Text | null>(null);
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
      setError(err instanceof AnalysisError ? err.localized : tr("That doesn't look like a valid URL.", "Non sembra un URL valido."));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, product, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? bothLanguages("genericError"));
        return;
      }
      setReport(data as AnalysisReport);
    } catch {
      setError(bothLanguages("networkError"));
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
      {p(error)}
    </div>
  );

  const form = (autoFocus: boolean) => (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Pills
        name="product"
        legend={t.productLabel}
        options={PRODUCTS}
        value={product}
        onChange={setProduct}
        label={(v) => (v === "landing" ? t.productLanding : t.productCoaching)}
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          autoFocus={autoFocus}
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={product === "landing" ? t.placeholderLanding : t.placeholderCoaching}
          aria-label="URL"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t.analyzing : t.analyze}
        </button>
      </div>
      {product === "coaching" && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-500">{t.funnelLabel}</span>
          <Pills
            name="mode"
            legend={t.funnelLabel}
            options={MODES}
            value={mode}
            onChange={setMode}
            label={(v) => (v === "auto" ? t.modeAuto : v === "call" ? t.modeCall : t.modeCheckout)}
          />
        </div>
      )}
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        {!hasResult ? (
          <div className="flex min-h-[75vh] flex-col items-center justify-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">{t.appTitle}</h1>
            <p className="mt-3 max-w-xl text-center text-sm text-slate-400">
              {product === "landing" ? t.subtitleLanding : t.subtitleCoaching}
            </p>
            <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {BENCHMARKS[product].map((b) => (
                <span key={p(b)} className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
                  {p(b)}
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
            <div className="max-w-xl mx-auto mt-4">
              <h1 className="mb-6 text-xl font-bold tracking-tight text-center">{t.appTitle}</h1>
              {errorBox}
              {form(false)}
            </div>

            {loading && !report && (
              <div className="mt-12 flex flex-col items-center gap-3 text-slate-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
                <p className="text-sm text-center">{product === "landing" ? t.loadingLanding : t.loadingCoaching}</p>
              </div>
            )}

            {report && (
              <div className="mt-12 space-y-8">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col sm:flex-row items-center gap-6">
                  <ScoreGauge score={report.overallScore} size={120} strokeWidth={10} />
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-slate-400">
                      {report.product === "landing" ? t.overallLanding : t.overallCoaching}
                    </p>
                    <p className="text-2xl font-bold text-slate-100">
                      {t.grade} {report.overallGrade} · {report.overallScore}/100
                    </p>
                    <p className="mt-1 text-sm text-slate-500 break-all">{report.finalUrl}</p>
                  </div>
                </div>

                {report.topRecommendations.length > 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    <h2 className="text-lg font-semibold text-slate-100">{t.topRecommendations}</h2>
                    <ol className="mt-3 space-y-2 list-decimal list-inside text-sm text-slate-300">
                      {report.topRecommendations.map((r, i) => (
                        <li key={i}>
                          <span className="font-medium text-slate-200">[{p(r.category)}]</span> {p(r.detail)}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {report.funnel && <FunnelFlow funnel={report.funnel} />}

                {report.blueprint && report.blueprint.length > 0 && (
                  <Blueprint
                    sections={report.blueprint}
                    title={report.funnel?.type === "call" ? t.blueprintCall : t.blueprintCheckout}
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

