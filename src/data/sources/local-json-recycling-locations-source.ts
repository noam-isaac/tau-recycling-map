import type { RecyclingLocationsSource } from "@/data/sources/recycling-locations-source";
import type { RecyclingLocationsSnapshot } from "@/data/types";
import { validateRecyclingCatalog } from "@/data/validation/recycling-catalog";

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;

  throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

export class LocalJsonRecyclingLocationsSource implements RecyclingLocationsSource {
  readonly #catalog: unknown;

  constructor(catalog: unknown) {
    this.#catalog = catalog;
  }

  load(signal: AbortSignal): Promise<RecyclingLocationsSnapshot> {
    return Promise.resolve().then(() => {
      throwIfAborted(signal);
      const catalog = validateRecyclingCatalog(this.#catalog);
      throwIfAborted(signal);
      return {
        version: catalog.version,
        source: catalog.source,
        generatedAt: catalog.generatedAt,
        locations: catalog.locations,
      };
    });
  }
}

export function createLocalJsonRecyclingLocationsSource(
  catalog: unknown,
): RecyclingLocationsSource {
  return new LocalJsonRecyclingLocationsSource(catalog);
}
