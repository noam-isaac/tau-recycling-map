import { useCallback, useEffect, useState } from "react";
import type { RecyclingLocationsSource } from "@/data/sources/recycling-locations-source";
import type { RecyclingCategory, RecyclingLocationsSnapshot } from "@/data/types";
import { validateRecyclingLocationsSnapshot } from "@/data/validation/recycling-catalog";

type LocationsLoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: RecyclingLocationsSnapshot }
  | { status: "error"; error: Error };

export type RecyclingLocationsLoadResult = LocationsLoadState & {
  retry: () => void;
};

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown location loading error");
}

export function useRecyclingLocations(
  source: RecyclingLocationsSource,
  categories: readonly RecyclingCategory[],
): RecyclingLocationsLoadResult {
  const [loadRequest, setLoadRequest] = useState(0);
  const [state, setState] = useState<LocationsLoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let ignoreResult = false;

    void Promise.resolve()
      .then(() => {
        if (ignoreResult) {
          throw (
            controller.signal.reason ??
            new DOMException("The operation was aborted.", "AbortError")
          );
        }
        setState({ status: "loading" });
        return source
          .load(controller.signal)
          .then((snapshot) => validateRecyclingLocationsSnapshot(snapshot, categories));
      })
      .then(
        (snapshot) => {
          if (!ignoreResult) setState({ status: "ready", snapshot });
        },
        (error: unknown) => {
          if (!ignoreResult) {
            setState({ status: "error", error: normalizeError(error) });
          }
        },
      );

    return () => {
      ignoreResult = true;
      controller.abort();
    };
  }, [categories, loadRequest, source]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setLoadRequest((request) => request + 1);
  }, []);

  return { ...state, retry };
}
