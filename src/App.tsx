import { RecyclingMapApp } from "@/RecyclingMapApp";
import {
  getRecyclingDataSourceConfig,
  recyclingLocationsSourceEnabled,
} from "@/config/recycling-data";
import catalogJson from "@/data/recycling-locations.json";
import type { RecyclingLocationsSource } from "@/data/sources/recycling-locations-source";
import type { RecyclingCatalog, RecyclingCategory } from "@/data/types";
import { useRecyclingLocations } from "@/hooks/useRecyclingLocations";

interface AppProps {
  enableDataSourceRefactor?: boolean;
  categories?: readonly RecyclingCategory[];
  locationsSource?: RecyclingLocationsSource;
}

const bundledCatalog: RecyclingCatalog = catalogJson;

type CatalogStateProps =
  { status: "loading" } | { status: "error"; onRetry: () => void };

function CatalogState(props: CatalogStateProps) {
  const isError = props.status === "error";
  return (
    <main className="home-shell catalog-state" lang="he" dir="rtl">
      <section className="catalog-state-card">
        <span className="home-eyebrow">מפת המיחזור בקמפוס</span>
        <h1>{isError ? "לא הצלחנו לטעון את המפה" : "טוען את נקודות המיחזור…"}</h1>
        {isError ? (
          <>
            <p role="alert">אירעה שגיאה בטעינת הנתונים. אפשר לנסות שוב.</p>
            <button type="button" onClick={props.onRetry}>
              ניסיון נוסף
            </button>
          </>
        ) : (
          <p role="status">הנתונים יופיעו בעוד רגע.</p>
        )}
      </section>
    </main>
  );
}

function DataSourceBackedApp({
  categories,
  locationsSource,
}: Required<Pick<AppProps, "categories" | "locationsSource">>) {
  const locationsState = useRecyclingLocations(locationsSource, categories);

  if (locationsState.status === "loading") {
    return <CatalogState status="loading" />;
  }
  if (locationsState.status === "error") {
    return <CatalogState status="error" onRetry={locationsState.retry} />;
  }
  return <RecyclingMapApp catalog={{ ...locationsState.snapshot, categories }} />;
}

export default function App({
  enableDataSourceRefactor = recyclingLocationsSourceEnabled,
  categories,
  locationsSource,
}: AppProps) {
  if (!enableDataSourceRefactor) {
    return <RecyclingMapApp catalog={bundledCatalog} />;
  }

  const defaultConfig = getRecyclingDataSourceConfig();

  return (
    <DataSourceBackedApp
      categories={categories ?? defaultConfig.categories}
      locationsSource={locationsSource ?? defaultConfig.locationsSource}
    />
  );
}
