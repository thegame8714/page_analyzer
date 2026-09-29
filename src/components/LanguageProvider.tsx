"use client";

import { ReactNode, createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { Lang, Text, pick } from "@/lib/analyze/types";
import { DICTIONARIES, Dictionary } from "@/lib/i18n";

const STORAGE_KEY = "lang";
const listeners = new Set<() => void>();
// Fallback when storage is unavailable (private mode, blocked site data), so
// the toggle still works for the current visit.
let memoryLang: Lang | null = null;

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "it";
}

function readLang(): Lang {
  if (memoryLang) return memoryLang;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // storage blocked — fall through to the browser language
  }
  return navigator.language?.toLowerCase().startsWith("it") ? "it" : "en";
}

function writeLang(lang: Lang) {
  memoryLang = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // keep the in-memory choice only
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Interface strings for the current language. */
  t: Dictionary;
  /** Resolve report copy (string or { en, it }) to the current language. */
  p: (text: Text) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server render is always English; the client switches to the saved or
  // browser language right after hydration.
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    setLang: writeLang,
    t: DICTIONARIES[lang],
    p: (text) => pick(text, lang),
  };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}

export function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div role="group" aria-label={t.language} className="inline-flex rounded-full border border-slate-700 p-0.5 text-xs">
      {(["en", "it"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          aria-label={l === "en" ? "English" : "Italiano"}
          className={`rounded-full px-3 py-1 font-medium uppercase transition ${
            lang === l ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
