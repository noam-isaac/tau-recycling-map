import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Locale } from "@/data/types";
import { appCopy } from "@/i18n";

interface MapHeaderProps {
  locale: Locale;
  mapTitle: string;
  locationCount: number;
  onBack: () => void;
  onLocaleChange: (locale: Locale) => void;
}

export function MapHeader({
  locale,
  mapTitle,
  locationCount,
  onBack,
  onLocaleChange,
}: MapHeaderProps) {
  const copy = appCopy[locale];

  return (
    <header className="topbar">
      <div className="brand-block">
        <span className="brand-kicker">{copy.campus}</span>
        <h1>{mapTitle}</h1>
        <span className="brand-count">
          {locationCount} {copy.points}
        </span>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="back-button"
          aria-label={copy.back}
          onClick={onBack}
        >
          <span className="back-arrow" aria-hidden="true">
            {locale === "he" ? "→" : "←"}
          </span>
          <span className="back-label">{copy.back}</span>
        </button>
        <LanguageSwitcher locale={locale} onLocaleChange={onLocaleChange} />
      </div>
    </header>
  );
}
