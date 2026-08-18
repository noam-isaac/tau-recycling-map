import type { RecyclingLocationsSnapshot } from "@/data/types";

export interface RecyclingLocationsSource {
  load(signal: AbortSignal): Promise<RecyclingLocationsSnapshot>;
}
