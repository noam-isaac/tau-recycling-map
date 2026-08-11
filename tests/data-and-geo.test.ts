import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import catalog from "../src/data/recycling-locations.json";
import {
  bearingCardinal,
  distanceMeters,
  formatDistance,
  googleWalkingDirectionsUrl,
  initialBearing,
  nearestLocation,
  relativeBearing,
} from "../src/lib/geo";

describe("normalized recycling dataset", () => {
  it("contains every unique source point in the expected categories", () => {
    expect(catalog.locations).toHaveLength(89);
    expect(catalog.categories).toHaveLength(6);
    expect(new Set(catalog.locations.map(({ lat, lng }) => `${lat},${lng}`)).size).toBe(
      89,
    );

    const counts = Object.fromEntries(
      catalog.categories.map(({ id }) => [
        id,
        catalog.locations.filter(({ categoryId }) => categoryId === id).length,
      ]),
    );
    expect(counts).toEqual({
      cardboard: 10,
      "beverage-containers": 26,
      paper: 26,
      "batteries-ewaste": 10,
      packaging: 13,
      general: 4,
    });
    expect(new Set(catalog.categories.map(({ icon }) => icon)).size).toBe(6);
    expect(catalog.categories.every(({ icon }) => icon.endsWith(".svg"))).toBe(true);
  });

  it("preserves source descriptions and campus bounds", () => {
    expect(
      catalog.locations.filter(({ descriptionHe }) => descriptionHe === null),
    ).toHaveLength(8);
    expect(Math.min(...catalog.locations.map(({ lat }) => lat))).toBeCloseTo(
      32.1089879,
      7,
    );
    expect(Math.max(...catalog.locations.map(({ lat }) => lat))).toBeCloseTo(
      32.1172201,
      7,
    );
    expect(Math.min(...catalog.locations.map(({ lng }) => lng))).toBeCloseTo(
      34.8017729,
      7,
    );
    expect(Math.max(...catalog.locations.map(({ lng }) => lng))).toBeCloseTo(
      34.8082738,
      7,
    );
  });

  it("keeps identifiers, category references, metadata, and SVG assets valid", async () => {
    const categoryIds = new Set(catalog.categories.map(({ id }) => id));
    expect(new Set(catalog.locations.map(({ id }) => id)).size).toBe(
      catalog.locations.length,
    );
    expect(catalog.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(catalog.source).toMatch(/\.kmz$/i);

    for (const location of catalog.locations) {
      expect(categoryIds.has(location.categoryId)).toBe(true);
      expect(Number.isFinite(location.lat)).toBe(true);
      expect(Number.isFinite(location.lng)).toBe(true);
      expect(location.lat).toBeGreaterThanOrEqual(-90);
      expect(location.lat).toBeLessThanOrEqual(90);
      expect(location.lng).toBeGreaterThanOrEqual(-180);
      expect(location.lng).toBeLessThanOrEqual(180);

      if ("imageUrl" in location) {
        expect(typeof location.imageUrl).toBe("string");
        if (typeof location.imageUrl !== "string") continue;

        const isLocalUrl =
          location.imageUrl.startsWith("/") && !location.imageUrl.startsWith("//");
        const isHttpsUrl = (() => {
          try {
            return new URL(location.imageUrl).protocol === "https:";
          } catch {
            return false;
          }
        })();
        expect(isLocalUrl || isHttpsUrl).toBe(true);

        if (isLocalUrl) {
          const imagePath = path.join(
            process.cwd(),
            "public",
            location.imageUrl.replace(/^\/+/, ""),
          );
          await expect(readFile(imagePath)).resolves.not.toHaveLength(0);
        }
      }
    }

    for (const category of catalog.categories) {
      const iconPath = path.join(
        process.cwd(),
        "public",
        category.icon.replace(/^\//, ""),
      );
      const icon = await readFile(iconPath, "utf8");
      expect(icon.trimStart()).toMatch(/^<svg\b/);
    }
  });
});

describe("relative location utilities", () => {
  const campusSouth = { lat: 32.1089879, lng: 34.8044 };
  const campusNorth = { lat: 32.1172201, lng: 34.8044 };

  it("calculates a northward campus distance and bearing", () => {
    const distance = distanceMeters(campusSouth, campusNorth);
    const bearing = initialBearing(campusSouth, campusNorth);
    expect(distance).toBeGreaterThan(900);
    expect(distance).toBeLessThan(920);
    expect(bearing).toBeCloseTo(0, 0);
    expect(bearingCardinal(bearing)).toBe("N");
  });

  it("formats metric distance for both interface languages", () => {
    expect(formatDistance(247, "en")).toBe("245 m");
    expect(formatDistance(247, "he")).toBe("245 מ׳");
    expect(formatDistance(1640, "en")).toBe("1.6 km");
    expect(formatDistance(1640, "he")).toBe("1.6 ק״מ");
  });

  it("creates a keyless Google Maps walking URL", () => {
    const url = new URL(googleWalkingDirectionsUrl(campusNorth));
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("32.1172201,34.8044");
    expect(url.searchParams.get("travelmode")).toBe("walking");
    expect(url.searchParams.has("key")).toBe(false);
  });

  it("selects the closest location", () => {
    const points = [
      { id: "north", ...campusNorth },
      { id: "south", ...campusSouth },
    ];
    expect(nearestLocation({ lat: 32.1091, lng: 34.8044 }, points)?.id).toBe("south");
    expect(nearestLocation(campusSouth, [])).toBeNull();
  });

  it("normalizes negative and wrapped bearings", () => {
    expect(bearingCardinal(-45)).toBe("NW");
    expect(bearingCardinal(360)).toBe("N");
    expect(bearingCardinal(450)).toBe("E");
  });

  it("turns a north-based bearing into a direction relative to the device", () => {
    expect(relativeBearing(90, 0)).toBe(90);
    expect(relativeBearing(90, 90)).toBe(0);
    expect(relativeBearing(90, 180)).toBe(270);
    expect(relativeBearing(10, 350)).toBe(20);
  });
});
