export type Locale = "he" | "en";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface UserLocation extends Coordinates {
  accuracy: number;
}

export type GeolocationStatus =
  "idle" | "locating" | "active" | "denied" | "unavailable" | "timeout" | "unsupported";

export interface LocalizedLabel {
  he: string;
  en: string;
}

export interface RecyclingCategory {
  id: string;
  label: LocalizedLabel;
  color: string;
  icon: string;
}

export interface RecyclingLocation extends Coordinates {
  id: string;
  categoryId: string;
  descriptionHe: string | null;
}

export interface RecyclingCatalog {
  version: number;
  source: string;
  generatedAt: string;
  categories: readonly RecyclingCategory[];
  locations: readonly RecyclingLocation[];
}
