import { describe, expect, it } from "vitest";
import categoriesConfig from "../src/config/recycling-categories.json";
import productionCatalog from "../src/data/recycling-locations.json";
import { createLocalJsonRecyclingLocationsSource } from "../src/data/sources/local-json-recycling-locations-source";
import {
  RecyclingCatalogValidationError,
  validateRecyclingCatalog,
  validateRecyclingCategories,
  validateRecyclingLocationsSnapshot,
} from "../src/data/validation/recycling-catalog";

function validCatalog() {
  return {
    version: 1,
    source: "fixture.kmz",
    generatedAt: "2026-08-11",
    categories: [
      {
        id: "paper",
        label: { he: "נייר", en: "Paper" },
        color: "#4f91d7",
        icon: "./icons/paper.svg",
      },
    ],
    locations: [
      {
        id: "paper-1",
        categoryId: "paper",
        lat: 32.1133,
        lng: 34.8044,
        descriptionHe: null,
        imageUrl: "./images/paper.webp",
      },
    ],
  };
}

describe("local recycling locations source", () => {
  it("loads only point data and provenance through the catalog validator", async () => {
    const source = createLocalJsonRecyclingLocationsSource(validCatalog());
    const signal = new AbortController().signal;

    await expect(source.load(signal)).resolves.toEqual({
      version: 1,
      source: "fixture.kmz",
      generatedAt: "2026-08-11",
      locations: validCatalog().locations,
    });
  });

  it("loads the production JSON through the same provider boundary", async () => {
    const source = createLocalJsonRecyclingLocationsSource(productionCatalog);
    const snapshot = await source.load(new AbortController().signal);

    expect(snapshot.version).toBe(1);
    expect(snapshot).not.toHaveProperty("categories");
    expect(
      snapshot.locations.some(({ id }) => id === "cardboard-321144828-348068464"),
    ).toBe(true);
  });

  it("rejects an already-aborted load", async () => {
    const source = createLocalJsonRecyclingLocationsSource(validCatalog());
    const controller = new AbortController();
    controller.abort();

    await expect(source.load(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects invalid input when it is loaded", async () => {
    const source = createLocalJsonRecyclingLocationsSource({ locations: [] });

    await expect(source.load(new AbortController().signal)).rejects.toBeInstanceOf(
      RecyclingCatalogValidationError,
    );
  });
});

describe("recycling data validation", () => {
  const withLocation = (patch: Record<string, unknown>): unknown => {
    const catalog = validCatalog();
    return {
      ...catalog,
      locations: [{ ...catalog.locations[0], ...patch }],
    };
  };

  const duplicateCategoryIds = (): unknown => {
    const catalog = validCatalog();
    return {
      ...catalog,
      categories: [catalog.categories[0], { ...catalog.categories[0] }],
    };
  };

  const duplicateLocationIds = (): unknown => {
    const catalog = validCatalog();
    return {
      ...catalog,
      locations: [catalog.locations[0], { ...catalog.locations[0] }],
    };
  };

  it("keeps UI category configuration separate and synchronized", () => {
    const categories = validateRecyclingCategories(categoriesConfig);

    expect(categories).toEqual(productionCatalog.categories);
  });

  it("validates a provider snapshot against the local category contract", () => {
    const catalog = validCatalog();
    const snapshot = {
      version: catalog.version,
      source: "https://example.test/FeatureServer/0",
      generatedAt: catalog.generatedAt,
      locations: catalog.locations,
    };

    expect(validateRecyclingLocationsSnapshot(snapshot, catalog.categories)).toEqual(
      snapshot,
    );
    expect(() =>
      validateRecyclingLocationsSnapshot(
        { ...snapshot, locations: [{ ...snapshot.locations[0], categoryId: "glass" }] },
        catalog.categories,
      ),
    ).toThrow(/unknown category id/);
  });

  it.each([
    ["metadata", () => ({ ...validCatalog(), version: 0 }), /catalog\.version/],
    ["duplicate category IDs", duplicateCategoryIds, /duplicate id/],
    ["duplicate location IDs", duplicateLocationIds, /duplicate id/],
    [
      "unknown category references",
      () => withLocation({ categoryId: "glass" }),
      /unknown category id/,
    ],
    ["out-of-range latitude", () => withLocation({ lat: 91 }), /locations\[0\]\.lat/],
    [
      "out-of-range longitude",
      () => withLocation({ lng: -181 }),
      /locations\[0\]\.lng/,
    ],
    [
      "invalid descriptions",
      () => withLocation({ descriptionHe: 42 }),
      /descriptionHe/,
    ],
    ["invalid image values", () => withLocation({ imageUrl: null }), /imageUrl/],
    [
      "insecure image URLs",
      () => withLocation({ imageUrl: "http://example.com/bin.jpg" }),
      /safe \.\/ asset path or an HTTPS URL/,
    ],
    [
      "escaping image paths",
      () => withLocation({ imageUrl: "./images/../secret.jpg" }),
      /safe \.\/ asset path or an HTTPS URL/,
    ],
  ])("rejects %s", (_caseName, createCatalog, expectedMessage) => {
    expect(() => validateRecyclingCatalog(createCatalog())).toThrow(expectedMessage);
  });

  it("accepts empty locations and omitted optional images", () => {
    const catalog = { ...validCatalog(), locations: [] };

    expect(validateRecyclingCatalog(catalog).locations).toEqual([]);

    const catalogWithImage = validCatalog();
    const locationWithImage = catalogWithImage.locations[0];
    if (!locationWithImage) throw new Error("Missing fixture location");
    const locationWithoutImage = {
      id: locationWithImage.id,
      categoryId: locationWithImage.categoryId,
      lat: locationWithImage.lat,
      lng: locationWithImage.lng,
      descriptionHe: locationWithImage.descriptionHe,
    };
    const catalogWithoutImage = {
      ...catalogWithImage,
      locations: [locationWithoutImage],
    };

    expect(
      validateRecyclingCatalog(catalogWithoutImage).locations[0],
    ).not.toHaveProperty("imageUrl");
  });
});
