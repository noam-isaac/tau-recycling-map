import categoriesJson from "@/config/recycling-categories.json";
import catalogJson from "@/data/recycling-locations.json";
import { createLocalJsonRecyclingLocationsSource } from "@/data/sources/local-json-recycling-locations-source";
import type { RecyclingLocationsSource } from "@/data/sources/recycling-locations-source";
import type { RecyclingCategory } from "@/data/types";
import { validateRecyclingCategories } from "@/data/validation/recycling-catalog";

// Keep the provider-backed path dormant until a remote point source is ready
// to replace the bundled catalog. App.tsx still supports exercising this path
// explicitly in tests without changing the shipped application's behavior.
export const recyclingLocationsSourceEnabled = false;

interface RecyclingDataSourceConfig {
  categories: readonly RecyclingCategory[];
  locationsSource: RecyclingLocationsSource;
}

let cachedConfig: RecyclingDataSourceConfig | undefined;

export function getRecyclingDataSourceConfig(): RecyclingDataSourceConfig {
  cachedConfig ??= {
    // UI metadata stays local even when the active point source changes to ArcGIS.
    categories: validateRecyclingCategories(categoriesJson),
    // This is the single composition point for point storage. A future ArcGIS
    // adapter replaces this concrete source without changing the map components.
    locationsSource: createLocalJsonRecyclingLocationsSource(catalogJson),
  };
  return cachedConfig;
}
