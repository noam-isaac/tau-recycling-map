import type { Locale } from "@/data/types";
import { appCopy } from "@/i18n";

interface LanguageSwitcherProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export function LanguageSwitcher({ locale, onLocaleChange }: LanguageSwitcherProps) {
  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={appCopy[locale].languageSwitcher}
    >
      <button
        type="button"
        lang="he"
        className={locale === "he" ? "is-active" : ""}
        aria-pressed={locale === "he"}
        onClick={() => onLocaleChange("he")}
      >
        עברית
      </button>
      <button
        type="button"
        lang="en"
        className={locale === "en" ? "is-active" : ""}
        aria-pressed={locale === "en"}
        onClick={() => onLocaleChange("en")}
      >
        EN
      </button>
    </div>
  );
}
