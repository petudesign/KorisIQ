import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "fi" | "en";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  tr: (finnish: string, english: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  try {
    const stored = window.localStorage.getItem("korisiq-language");
    if (stored === "en" || stored === "fi") return stored;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return "fi";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem("korisiq-language", language);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    tr: (finnish: string, english: string) => language === "fi" ? finnish : english,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside LanguageProvider");
  return context;
}
