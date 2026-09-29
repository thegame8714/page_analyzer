"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Text, tr } from "@/lib/analyze/types";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { DICTIONARIES } from "@/lib/i18n";

// Only same-site paths: "?next=//evil.example" must not become an open redirect.
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !/^\/[\/\\]/.test(next) ? next : "/";
}

export default function LoginPage() {
  const { t, p } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Text | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        router.replace(safeNext());
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? tr(DICTIONARIES.en.genericError, DICTIONARIES.it.genericError));
    } catch {
      setError(tr(DICTIONARIES.en.networkError, DICTIONARIES.it.networkError));
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="flex min-h-[75vh] flex-col items-center justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">{t.appTitle}</h1>
          <form onSubmit={handleSubmit} className="mt-8 w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div>
              <h2 className="text-lg font-semibold">{t.loginTitle}</h2>
              <p className="mt-1 text-sm text-slate-400">{t.loginSubtitle}</p>
            </div>
            <label className="block text-sm">
              <span className="text-slate-300">{t.emailLabel}</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t.emailPlaceholder}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
                {p(error)}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t.signingIn : t.loginButton}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
