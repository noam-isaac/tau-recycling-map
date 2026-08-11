import { describe, expect, it } from "vitest";
import {
  parseKml,
  preserveLocationImageUrls,
  sourceIconFileName,
  stableId,
} from "../scripts/import-kmz.mjs";

const categories = [
  "קרטונייה",
  "מיכלי משקה",
  "נייר",
  "סוללות ופסולת אלקטרונית",
  "אריזות (פח כתום)",
  "כללי",
];

function fixtureKml({ duplicateCoordinates = false } = {}) {
  return `<kml>${categories
    .map((category, index) => {
      const coordinateIndex = duplicateCoordinates && index === 1 ? 0 : index;
      return `<Folder>
        <name>${category}</name>
        <Placemark>
          <ExtendedData>
            <Data name="description"><value><![CDATA[ליד חדר ${index + 1}]]></value></Data>
          </ExtendedData>
          <Point><coordinates>34.80${coordinateIndex},32.11${coordinateIndex},0</coordinates></Point>
        </Placemark>
      </Folder>`;
    })
    .join("")}</kml>`;
}

describe("KMZ importer", () => {
  it("parses and validates every category before producing a catalog", () => {
    const catalog = parseKml(fixtureKml(), {
      source: "fixture.kmz",
      generatedAt: "2026-08-01",
    });

    expect(catalog.categories).toHaveLength(6);
    expect(catalog.locations).toHaveLength(6);
    expect(catalog.locations[0]).toMatchObject({
      id: stableId("cardboard", 32.11, 34.8),
      categoryId: "cardboard",
      descriptionHe: "ליד חדר 1",
    });
  });

  it("keeps extracted source PNGs separate from UI SVGs", () => {
    const catalog = parseKml(fixtureKml(), {
      source: "fixture.kmz",
      generatedAt: "2026-08-01",
    });

    for (const category of catalog.categories) {
      expect(category.icon).toBe(`/icons/${category.id}.svg`);
      expect(sourceIconFileName(category.id)).toBe(`${category.id}.png`);
    }
  });

  it("preserves editorial image URLs by stable location ID", () => {
    const catalog = parseKml(fixtureKml(), {
      source: "fixture.kmz",
      generatedAt: "2026-08-01",
    });
    const imageUrl = "https://images.example.test/recycling/cardboard.webp";
    const firstLocation = catalog.locations[0];
    expect(firstLocation).toBeDefined();

    const refreshedCatalog = preserveLocationImageUrls(catalog, {
      locations: [
        { id: firstLocation?.id, imageUrl: ` ${imageUrl} ` },
        { id: "removed-location", imageUrl: "https://images.example.test/old.webp" },
      ],
    });

    expect(refreshedCatalog.locations[0]).toMatchObject({ imageUrl });
    expect(refreshedCatalog.locations[1]).not.toHaveProperty("imageUrl");
  });

  it("rejects duplicate coordinates instead of writing ambiguous data", () => {
    expect(() =>
      parseKml(fixtureKml({ duplicateCoordinates: true }), {
        source: "fixture.kmz",
        generatedAt: "2026-08-01",
      }),
    ).toThrow(/Duplicate coordinates/);
  });
});
