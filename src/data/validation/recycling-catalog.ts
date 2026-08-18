import type {
  RecyclingCatalog,
  RecyclingCategory,
  RecyclingLocation,
  RecyclingLocationsSnapshot,
} from "@/data/types";

type UnknownRecord = Record<string, unknown>;

export class RecyclingCatalogValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "RecyclingCatalogValidationError";
  }
}

function fail(path: string, message: string): never {
  throw new RecyclingCatalogValidationError(path, message);
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "expected an object");
  }
  return value as UnknownRecord;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "expected a string");
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  const stringValue = requireString(value, path);
  if (stringValue.trim() === "") fail(path, "expected a non-empty string");
  return stringValue;
}

function requirePublicAssetUrl(value: unknown, path: string): string {
  const url = requireNonEmptyString(value, path);
  const isSafeRelativeUrl =
    url.startsWith("./") && !url.startsWith("//") && !url.split("/").includes("..");
  const isHttpsUrl = (() => {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  })();

  if (!isSafeRelativeUrl && !isHttpsUrl) {
    fail(path, "expected a safe ./ asset path or an HTTPS URL");
  }
  return url;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected a finite number");
  }
  return value;
}

function requireCoordinate(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  const coordinate = requireFiniteNumber(value, path);
  if (coordinate < minimum || coordinate > maximum) {
    fail(path, `expected a number between ${minimum} and ${maximum}`);
  }
  return coordinate;
}

function validateCategory(value: unknown, index: number): RecyclingCategory {
  const path = `categories[${index}]`;
  const category = requireRecord(value, path);
  const label = requireRecord(category["label"], `${path}.label`);

  return {
    id: requireNonEmptyString(category["id"], `${path}.id`),
    label: {
      he: requireNonEmptyString(label["he"], `${path}.label.he`),
      en: requireNonEmptyString(label["en"], `${path}.label.en`),
    },
    color: requireNonEmptyString(category["color"], `${path}.color`),
    icon: requirePublicAssetUrl(category["icon"], `${path}.icon`),
  };
}

function validateLocation(value: unknown, index: number): RecyclingLocation {
  const path = `locations[${index}]`;
  const location = requireRecord(value, path);
  const descriptionHe = location["descriptionHe"];

  if (descriptionHe !== null && typeof descriptionHe !== "string") {
    fail(`${path}.descriptionHe`, "expected a string or null");
  }

  const validatedLocation: RecyclingLocation = {
    id: requireNonEmptyString(location["id"], `${path}.id`),
    categoryId: requireNonEmptyString(location["categoryId"], `${path}.categoryId`),
    lat: requireCoordinate(location["lat"], `${path}.lat`, -90, 90),
    lng: requireCoordinate(location["lng"], `${path}.lng`, -180, 180),
    descriptionHe,
  };

  if (Object.hasOwn(location, "imageUrl")) {
    return {
      ...validatedLocation,
      imageUrl: requirePublicAssetUrl(location["imageUrl"], `${path}.imageUrl`),
    };
  }

  return validatedLocation;
}

function assertUniqueIds(
  items: readonly { id: string }[],
  path: "categories" | "locations",
): void {
  const seenIds = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seenIds.has(item.id)) {
      fail(`${path}[${index}].id`, `duplicate id "${item.id}"`);
    }
    seenIds.add(item.id);
  }
}

export function validateRecyclingCategories(
  value: unknown,
): readonly RecyclingCategory[] {
  const categories = requireArray(value, "categories").map(validateCategory);
  assertUniqueIds(categories, "categories");
  return categories;
}

function validateLocationsSnapshot(
  value: unknown,
  categories: readonly RecyclingCategory[],
  path: string,
): RecyclingLocationsSnapshot {
  const snapshot = requireRecord(value, path);
  const version = requireFiniteNumber(snapshot["version"], `${path}.version`);
  if (!Number.isInteger(version) || version < 1) {
    fail(`${path}.version`, "expected a positive integer");
  }

  const locations = requireArray(snapshot["locations"], `${path}.locations`).map(
    validateLocation,
  );
  assertUniqueIds(locations, "locations");

  const categoryIds = new Set(categories.map(({ id }) => id));
  for (const [index, location] of locations.entries()) {
    if (!categoryIds.has(location.categoryId)) {
      fail(
        `locations[${index}].categoryId`,
        `unknown category id "${location.categoryId}"`,
      );
    }
  }

  return {
    version,
    source: requireNonEmptyString(snapshot["source"], `${path}.source`),
    generatedAt: requireNonEmptyString(snapshot["generatedAt"], `${path}.generatedAt`),
    locations,
  };
}

export function validateRecyclingLocationsSnapshot(
  value: unknown,
  categories: readonly RecyclingCategory[],
): RecyclingLocationsSnapshot {
  return validateLocationsSnapshot(value, categories, "snapshot");
}

export function validateRecyclingCatalog(value: unknown): RecyclingCatalog {
  const catalog = requireRecord(value, "catalog");
  const categories = validateRecyclingCategories(catalog["categories"]);
  const snapshot = validateLocationsSnapshot(catalog, categories, "catalog");

  return {
    ...snapshot,
    categories,
  };
}
