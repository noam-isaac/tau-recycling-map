import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{
 *   id: string;
 *   label: { he: string; en: string };
 *   color: string;
 *   icon: string;
 *   sourceIcon: number;
 * }} CategoryDefinition
 */

/** @type {Readonly<Record<string, CategoryDefinition>>} */
const categoryDefinitions = {
  קרטונייה: {
    id: "cardboard",
    label: { he: "קרטונייה", en: "Cardboard" },
    color: "#a76d3a",
    icon: "/icons/cardboard.svg",
    sourceIcon: 1,
  },
  "מיכלי משקה": {
    id: "beverage-containers",
    label: { he: "מיכלי משקה", en: "Beverage containers" },
    color: "#22a8a2",
    icon: "/icons/beverage-containers.svg",
    sourceIcon: 2,
  },
  נייר: {
    id: "paper",
    label: { he: "נייר", en: "Paper" },
    color: "#4f91d7",
    icon: "/icons/paper.svg",
    sourceIcon: 3,
  },
  "סוללות ופסולת אלקטרונית": {
    id: "batteries-ewaste",
    label: { he: "סוללות ופסולת אלקטרונית", en: "Batteries & e-waste" },
    color: "#8b6cc4",
    icon: "/icons/batteries-ewaste.svg",
    sourceIcon: 4,
  },
  "אריזות (פח כתום)": {
    id: "packaging",
    label: { he: "אריזות (פח כתום)", en: "Packaging (orange bin)" },
    color: "#f08a2f",
    icon: "/icons/packaging.svg",
    sourceIcon: 5,
  },
  כללי: {
    id: "general",
    label: { he: "כללי", en: "General" },
    color: "#64756d",
    icon: "/icons/general.svg",
    sourceIcon: 6,
  },
};

/** @param {string} value */
function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** @param {string} value */
function normalizeText(value) {
  return decodeXml(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} block
 * @param {string} tagName
 */
function tagText(block, tagName) {
  const match = block.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`),
  );
  return match?.[1] ? normalizeText(match[1]) : "";
}

/** @param {string} placemark */
function extendedValues(placemark) {
  /** @type {Array<{key: string; value: string}>} */
  const values = [];
  const pattern = /<Data\s+name="([^"]+)">([\s\S]*?)<\/Data>/g;
  for (const match of placemark.matchAll(pattern)) {
    const value = tagText(match[2] ?? "", "value");
    if (value) values.push({ key: normalizeText(match[1] ?? ""), value });
  }
  return values;
}

/** @param {string} placemark */
function extractDescription(placemark) {
  const values = extendedValues(placemark);
  const locationNote = values.find(
    ({ key }) => key === "description" || key === "תיאור",
  )?.value;
  if (locationNote) return locationNote;

  const sourceLabel = values.find(({ key }) => key === "name" || key === "שם")?.value;
  return sourceLabel || null;
}

/**
 * @param {string} categoryId
 * @param {number} lat
 * @param {number} lng
 */
export function stableId(categoryId, lat, lng) {
  return `${categoryId}-${lat.toFixed(7).replace(/\./g, "")}-${lng
    .toFixed(7)
    .replace(/\./g, "")}`;
}

/** @param {string} categoryId */
export function sourceIconFileName(categoryId) {
  return `${categoryId}.png`;
}

/**
 * @param {string} kml
 * @param {{source: string; generatedAt: string}} metadata
 */
export function parseKml(kml, metadata) {
  /** @type {Array<{
   *   id: string;
   *   categoryId: string;
   *   lat: number;
   *   lng: number;
   *   descriptionHe: string | null;
   * }>} */
  const locations = [];
  const foundCategoryIds = new Set();
  const coordinateKeys = new Set();

  for (const folderMatch of kml.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g)) {
    const folder = folderMatch[1] ?? "";
    const categoryName = tagText(folder, "name");
    const category = categoryDefinitions[categoryName];
    if (!category) continue;
    foundCategoryIds.add(category.id);

    for (const placemarkMatch of folder.matchAll(
      /<Placemark>([\s\S]*?)<\/Placemark>/g,
    )) {
      const placemark = placemarkMatch[1] ?? "";
      const coordinates = tagText(placemark, "coordinates")
        .split(",")
        .slice(0, 2)
        .map(Number);
      const lng = coordinates[0];
      const lat = coordinates[1];
      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        throw new Error(`Invalid coordinates in category: ${categoryName}`);
      }

      const coordinateKey = `${lat},${lng}`;
      if (coordinateKeys.has(coordinateKey)) {
        throw new Error(`Duplicate coordinates: ${coordinateKey}`);
      }
      coordinateKeys.add(coordinateKey);

      locations.push({
        id: stableId(category.id, lat, lng),
        categoryId: category.id,
        lat,
        lng,
        descriptionHe: extractDescription(placemark),
      });
    }
  }

  const categories = Object.values(categoryDefinitions).map(
    ({ id, label, color, icon }) => ({ id, label, color, icon }),
  );
  const missingCategories = categories
    .filter(({ id }) => !foundCategoryIds.has(id))
    .map(({ id }) => id);
  if (missingCategories.length > 0) {
    throw new Error(`Missing categories: ${missingCategories.join(", ")}`);
  }
  if (locations.length === 0) {
    throw new Error("No recycling locations were found in the KMZ file.");
  }

  return {
    version: 1,
    source: metadata.source,
    generatedAt: metadata.generatedAt,
    categories,
    locations,
  };
}

/**
 * Keep editorial image URLs when the source KMZ is refreshed. Location IDs are
 * derived from category and coordinates, so they are stable across imports.
 *
 * @param {ReturnType<typeof parseKml>} catalog
 * @param {unknown} previousCatalog
 */
export function preserveLocationImageUrls(catalog, previousCatalog) {
  if (
    typeof previousCatalog !== "object" ||
    previousCatalog === null ||
    !("locations" in previousCatalog) ||
    !Array.isArray(previousCatalog.locations)
  ) {
    return catalog;
  }

  /** @type {Map<string, string>} */
  const imageUrlById = new Map();
  /** @type {unknown[]} */
  const previousLocations = previousCatalog.locations;

  for (const location of previousLocations) {
    if (
      typeof location !== "object" ||
      location === null ||
      !("id" in location) ||
      !("imageUrl" in location) ||
      typeof location.id !== "string" ||
      typeof location.imageUrl !== "string" ||
      location.imageUrl.trim() === ""
    ) {
      continue;
    }
    imageUrlById.set(location.id, location.imageUrl.trim());
  }

  if (imageUrlById.size === 0) return catalog;

  return {
    ...catalog,
    locations: catalog.locations.map((location) => {
      const imageUrl = imageUrlById.get(location.id);
      return imageUrl ? { ...location, imageUrl } : location;
    }),
  };
}

/**
 * @param {string} catalogPath
 * @returns {Promise<unknown>}
 */
async function readExistingCatalog(catalogPath) {
  try {
    return JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * @param {string} targetPath
 * @param {string | Uint8Array} contents
 */
async function writeFileAtomically(targetPath, contents) {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, contents);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function main() {
  const kmzPath = process.argv[2];
  if (!kmzPath) {
    throw new Error("Usage: pnpm data:import /absolute/path/to/map.kmz");
  }

  const projectRoot = path.resolve(import.meta.dirname, "..");
  const dataDirectory = path.join(projectRoot, "src/data");
  const iconDirectory = path.join(projectRoot, "public/icons");
  const catalogPath = path.join(dataDirectory, "recycling-locations.json");
  const kml = execFileSync("unzip", ["-p", kmzPath, "doc.kml"], {
    encoding: "utf8",
    maxBuffer: 5_000_000,
  });
  const catalog = preserveLocationImageUrls(
    parseKml(kml, {
      source: path.basename(kmzPath),
      generatedAt: new Date().toISOString().slice(0, 10),
    }),
    await readExistingCatalog(catalogPath),
  );

  const sourceIcons = Object.values(categoryDefinitions).map((category) => ({
    fileName: sourceIconFileName(category.id),
    contents: execFileSync("unzip", [
      "-p",
      kmzPath,
      `images/icon-${category.sourceIcon}.png`,
    ]),
  }));

  await Promise.all([
    mkdir(dataDirectory, { recursive: true }),
    mkdir(iconDirectory, { recursive: true }),
  ]);
  await writeFileAtomically(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await Promise.all(
    sourceIcons.map(({ fileName, contents }) =>
      writeFileAtomically(path.join(iconDirectory, fileName), contents),
    ),
  );

  console.log(
    `Imported ${catalog.locations.length} locations across ${catalog.categories.length} categories.`,
  );
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) await main();
