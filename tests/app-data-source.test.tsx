import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import catalog from "../src/data/recycling-locations.json";
import type { RecyclingLocationsSource } from "../src/data/sources/recycling-locations-source";
import type { RecyclingLocationsSnapshot } from "../src/data/types";

const locationsSnapshot = {
  version: catalog.version,
  source: catalog.source,
  generatedAt: catalog.generatedAt,
  locations: catalog.locations,
} satisfies RecyclingLocationsSnapshot;

vi.mock("../src/RecyclingMapApp", () => ({
  RecyclingMapApp: ({
    catalog: loadedCatalog,
  }: {
    catalog: typeof catalog;
  }): ReactNode => <main>loaded {loadedCatalog.locations.length} locations</main>,
}));

afterEach(cleanup);

describe("App data source boundary", () => {
  it("keeps the provider-backed path disabled by default", () => {
    const load = vi.fn<RecyclingLocationsSource["load"]>();

    render(<App locationsSource={{ load }} />);

    expect(screen.getByText("loaded 89 locations")).toBeVisible();
    expect(load).not.toHaveBeenCalled();
  });

  it("shows a loading state until the source resolves", async () => {
    let resolveLocations: ((value: RecyclingLocationsSnapshot) => void) | undefined;
    const source: RecyclingLocationsSource = {
      load: vi.fn(
        () =>
          new Promise<RecyclingLocationsSnapshot>((resolve) => {
            resolveLocations = resolve;
          }),
      ),
    };

    render(<App enableDataSourceRefactor locationsSource={source} />);
    expect(screen.getByRole("status")).toHaveTextContent("הנתונים יופיעו בעוד רגע");

    await waitFor(() => expect(resolveLocations).toBeDefined());
    resolveLocations?.(locationsSnapshot);
    expect(await screen.findByText("loaded 89 locations")).toBeVisible();
  });

  it("lets the user retry after a source error", async () => {
    const load = vi
      .fn<RecyclingLocationsSource["load"]>()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(locationsSnapshot);

    render(<App enableDataSourceRefactor locationsSource={{ load }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "אירעה שגיאה בטעינת הנתונים",
    );

    fireEvent.click(screen.getByRole("button", { name: "ניסיון נוסף" }));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("loaded 89 locations")).toBeVisible();
  });

  it("rejects provider points that do not match the local categories", async () => {
    const invalidSnapshot: RecyclingLocationsSnapshot = {
      ...locationsSnapshot,
      locations: [
        {
          ...locationsSnapshot.locations[0]!,
          categoryId: "unknown-arcgis-value",
        },
      ],
    };
    const load = vi
      .fn<RecyclingLocationsSource["load"]>()
      .mockResolvedValue(invalidSnapshot);

    render(
      <App
        enableDataSourceRefactor
        categories={catalog.categories}
        locationsSource={{ load }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "אירעה שגיאה בטעינת הנתונים",
    );
  });

  it("aborts an in-flight load when it unmounts", async () => {
    let receivedSignal: AbortSignal | undefined;
    const source: RecyclingLocationsSource = {
      load: vi.fn((signal?: AbortSignal) => {
        receivedSignal = signal;
        return new Promise<RecyclingLocationsSnapshot>(() => undefined);
      }),
    };

    const view = render(<App enableDataSourceRefactor locationsSource={source} />);
    await waitFor(() => expect(receivedSignal).toBeDefined());
    view.unmount();

    expect(receivedSignal?.aborted).toBe(true);
  });

  it("does not start a duplicate source load during the StrictMode probe", async () => {
    const load = vi
      .fn<RecyclingLocationsSource["load"]>()
      .mockResolvedValue(locationsSnapshot);

    render(
      <StrictMode>
        <App enableDataSourceRefactor locationsSource={{ load }} />
      </StrictMode>,
    );

    expect(await screen.findByText("loaded 89 locations")).toBeVisible();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
