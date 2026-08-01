import { useMemo, type CSSProperties } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Locale, RecyclingCatalog } from "@/data/types";
import { appCopy } from "@/i18n";

interface RecyclingHomeProps {
  catalog: RecyclingCatalog;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onOpenMap: (categoryId: string) => void;
}

export function RecyclingHome({
  catalog,
  locale,
  onLocaleChange,
  onOpenMap,
}: RecyclingHomeProps) {
  const copy = appCopy[locale];
  const locationCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const location of catalog.locations) {
      counts.set(location.categoryId, (counts.get(location.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [catalog.locations]);

  return (
    <main className="home-shell" lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <header className="home-header">
        <div className="home-brand">
          <span>{copy.campus}</span>
          <strong>{copy.title}</strong>
        </div>
        <LanguageSwitcher locale={locale} onLocaleChange={onLocaleChange} />
      </header>

      <section className="home-content">
        <span className="home-eyebrow">{copy.homeEyebrow}</span>
        <h1>{copy.homeTitle}</h1>
        <p>{copy.homeIntro}</p>

        <div className="map-choice-grid">
          {catalog.categories.map((category) => (
            <button
              type="button"
              className="map-choice-card"
              key={category.id}
              style={{ "--category-color": category.color } as CSSProperties}
              onClick={() => onOpenMap(category.id)}
            >
              <span className="map-choice-icon" aria-hidden="true">
                <img src={category.icon} alt="" />
              </span>
              <span className="map-choice-copy">
                <strong>{category.label[locale]}</strong>
                <small>
                  {locationCountByCategory.get(category.id) ?? 0} {copy.points}
                </small>
              </span>
              <span className="map-choice-arrow" aria-hidden="true">
                ←
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="all-maps-button"
          onClick={() => onOpenMap("all")}
        >
          <span className="all-maps-icon" aria-hidden="true">
            <img src="/icons/all-types.svg" alt="" />
          </span>
          <span>
            <strong>{copy.openAll}</strong>
            <small>
              {catalog.locations.length} {copy.points}
            </small>
          </span>
          <span aria-hidden="true">←</span>
        </button>
      </section>
    </main>
  );
}
