import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/recycling-locations.json";
import { RecyclingMapApp } from "../src/RecyclingMapApp";

vi.mock("../src/MapViewport", () => ({
  MapViewport: ({
    locations,
    onSelect,
  }: {
    locations: readonly { id: string }[];
    onSelect: (id: string) => void;
  }): ReactNode => {
    const firstLocation = locations[0];
    return (
      <div data-testid="map-mock">
        <span data-testid="visible-count">{locations.length}</span>
        {firstLocation ? (
          <button type="button" onClick={() => onSelect(firstLocation.id)}>
            select-first-marker
          </button>
        ) : null}
      </div>
    );
  },
}));

const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
  window.navigator,
  "geolocation",
);
const originalDeviceOrientationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "DeviceOrientationEvent",
);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  if (originalGeolocationDescriptor) {
    Object.defineProperty(
      window.navigator,
      "geolocation",
      originalGeolocationDescriptor,
    );
  } else {
    Reflect.deleteProperty(window.navigator, "geolocation");
  }
  if (originalDeviceOrientationDescriptor) {
    Object.defineProperty(
      window,
      "DeviceOrientationEvent",
      originalDeviceOrientationDescriptor,
    );
  } else {
    Reflect.deleteProperty(window, "DeviceOrientationEvent");
  }
});

function installDeviceOrientation(): void {
  Object.defineProperty(window, "DeviceOrientationEvent", {
    configurable: true,
    value: class extends Event {},
  });
}

function installPermissionedDeviceOrientation() {
  const requestPermission = vi
    .fn<(absolute?: boolean) => Promise<PermissionState>>()
    .mockResolvedValue("granted");
  Object.defineProperty(window, "DeviceOrientationEvent", {
    configurable: true,
    value: class extends Event {
      static requestPermission = requestPermission;
    },
  });
  return requestPermission;
}

function dispatchDeviceHeading(heading: number): void {
  const event = new Event("deviceorientationabsolute");
  Object.defineProperties(event, {
    absolute: { value: true },
    alpha: { value: 360 - heading },
  });
  fireEvent(window, event);
}

function installGeolocation(overrides: Partial<Geolocation> = {}): Geolocation {
  const geolocation = {
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    ...overrides,
  } satisfies Geolocation;
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: geolocation,
  });
  return geolocation;
}

function position(
  latitude: number,
  longitude: number,
  accuracy: number,
): GeolocationPosition {
  return {
    coords: {
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

function geolocationError(code: number): GeolocationPositionError {
  return {
    code,
    message: "fixture error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

describe("RecyclingMapApp", () => {
  it("puts the selected map name in the header and localizes map navigation", () => {
    render(<RecyclingMapApp catalog={catalog} />);
    expect(screen.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("heading", { name: "איזה פח מחפשים?" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /קרטונייה/ }));
    expect(screen.getByTestId("visible-count")).toHaveTextContent("10");
    expect(screen.getByRole("heading", { name: "קרטונייה" })).toBeVisible();
    expect(screen.queryByText("המפה שנבחרה")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByRole("main")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("main")).toHaveAttribute("dir", "ltr");
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.title).toBe("Recycling map | Tel Aviv University");
    expect(screen.getByRole("heading", { name: "Cardboard" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to main map" })).toBeVisible();
    expect(screen.queryByText("חזרה למפה הראשית")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to main map" }));
    expect(
      screen.getByRole("heading", { name: "Which bin are you looking for?" }),
    ).toBeVisible();
  });

  it("synchronizes the selected map with initial and changed URL hashes", () => {
    window.history.replaceState(null, "", "/#map=paper");
    render(<RecyclingMapApp catalog={catalog} />);

    expect(screen.getByRole("heading", { name: "נייר" })).toBeVisible();
    expect(screen.getByTestId("visible-count")).toHaveTextContent("26");

    window.history.replaceState(null, "", "/#map=general");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(screen.getByRole("heading", { name: "כללי" })).toBeVisible();
    expect(screen.getByTestId("visible-count")).toHaveTextContent("4");

    window.history.replaceState(null, "", "/");
    fireEvent.popState(window);
    expect(screen.getByRole("heading", { name: "איזה פח מחפשים?" })).toBeVisible();
  });

  it("opens marker details and uses the localized fallback description", () => {
    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: "select-first-marker" }));

    const panel = screen.getByRole("complementary");
    expect(panel).toHaveTextContent("אין תיאור נוסף");
    expect(panel.querySelector(".detail-description")).toHaveAttribute("lang", "he");
    const photo = screen.getByRole("img", {
      name: "תמונה של נקודת המיחזור: קרטונייה",
    });
    expect(photo).toHaveAttribute("src", "/images/cardboard-bin-demo.webp");
    expect(photo).toHaveAttribute("loading", "lazy");
    expect(
      screen.getByRole("link", { name: /מסלול הליכה ב-Google Maps/ }),
    ).toHaveAttribute("href", expect.stringContaining("travelmode=walking"));

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(
      screen.getByRole("img", { name: "Photo of the recycling point: Cardboard" }),
    ).toBeVisible();

    fireEvent.error(photo);
    expect(screen.queryByTestId("location-photo")).not.toBeInTheDocument();
  });

  it("keeps the original details layout for a bin without an image", () => {
    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /מיכלי משקה/ }));
    fireEvent.click(screen.getByRole("button", { name: "select-first-marker" }));

    expect(screen.getByRole("complementary")).toHaveTextContent("מיכלי משקה");
    expect(screen.queryByTestId("location-photo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /מסלול הליכה ב-Google Maps/ }),
    ).toBeVisible();
  });

  it("retries after a denied location request without leaking the old watch", async () => {
    const watchPosition = vi
      .fn<Geolocation["watchPosition"]>()
      .mockImplementationOnce((_success, error) => {
        error?.(geolocationError(1));
        return 9;
      })
      .mockImplementationOnce((success) => {
        success(position(32.113, 34.805, 20));
        return 10;
      });
    const clearWatch = vi.fn<Geolocation["clearWatch"]>();
    installGeolocation({ clearWatch, watchPosition });

    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: /ניווט לפח הקרוב/ }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("הגישה למיקום נחסמה"),
    );
    fireEvent.click(screen.getByRole("button", { name: "ניסיון נוסף" }));

    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(2));
    expect(clearWatch).toHaveBeenCalledWith(9);
    expect(screen.getByRole("complementary")).toHaveTextContent(
      "נקודת המיחזור הקרובה אליי",
    );
  });

  it("shows live direction, distance, and accuracy without exposing a bearing angle", async () => {
    installDeviceOrientation();
    let pushPosition: PositionCallback | null = null;
    installGeolocation({
      watchPosition: vi.fn<Geolocation["watchPosition"]>((success) => {
        pushPosition = success;
        success(position(31.7683, 35.2137, 250));
        return 12;
      }),
    });
    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: /ניווט לפח הקרוב/ }));

    await waitFor(() => {
      const panel = screen.getByRole("complementary");
      expect(panel).toHaveTextContent("מרחק");
      expect(panel).toHaveTextContent("נקודת המיחזור הקרובה אליי");
      expect(panel).toHaveTextContent("ק״מ");
      expect(panel).toHaveTextContent("דיוק משוער");
      expect(panel).toHaveTextContent("250 מ׳");
      expect(panel).not.toHaveTextContent("°");
    });

    const distance = screen
      .getByRole("complementary")
      .querySelector<HTMLElement>(".distance-readout strong");
    expect(distance).not.toBeNull();
    const initialDistance = distance?.textContent;

    act(() => {
      pushPosition?.(position(32.113, 34.805, 20));
    });
    await waitFor(() => expect(distance?.textContent).not.toBe(initialDistance));

    expect(screen.queryByRole("img", { name: "חץ הכיוון לפח" })).toBeNull();
    expect(screen.getByRole("complementary")).toHaveTextContent("ממתין לנתוני המצפן");
    dispatchDeviceHeading(90);
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "חץ הכיוון לפח" })).toBeVisible();
      expect(screen.getByRole("complementary")).toHaveTextContent(
        "החץ מתעדכן לפי כיוון הטלפון",
      );
    });
  });

  it("requests absolute compass permission on browsers that gate orientation", async () => {
    const requestPermission = installPermissionedDeviceOrientation();
    installGeolocation({
      watchPosition: vi.fn<Geolocation["watchPosition"]>((success) => {
        success(position(32.113, 34.805, 20));
        return 14;
      }),
    });

    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: /ניווט לפח הקרוב/ }));

    await waitFor(() => expect(requestPermission).toHaveBeenCalledWith(true));
  });

  it("shows distance without an arrow when compass access is unavailable", async () => {
    Reflect.deleteProperty(window, "DeviceOrientationEvent");
    installGeolocation({
      watchPosition: vi.fn<Geolocation["watchPosition"]>((success) => {
        success(position(32.113, 34.805, 20));
        return 13;
      }),
    });

    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: /ניווט לפח הקרוב/ }));

    await waitFor(() => {
      const panel = screen.getByRole("complementary");
      expect(panel).toHaveTextContent("מרחק");
      expect(panel).toHaveTextContent("אין גישה למצפן — מוצג מרחק בלבד");
      expect(screen.queryByRole("img", { name: "חץ הכיוון לפח" })).toBeNull();
    });
  });

  it("reports unsupported geolocation and clears an active watch on unmount", () => {
    render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: /ניווט לפח הקרוב/ }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "הדפדפן הזה לא תומך בשיתוף מיקום",
    );

    cleanup();
    window.history.replaceState(null, "", "/");
    const clearWatch = vi.fn<Geolocation["clearWatch"]>();
    installGeolocation({
      clearWatch,
      watchPosition: vi.fn(() => 42),
    });
    const view = render(<RecyclingMapApp catalog={catalog} />);
    fireEvent.click(screen.getByRole("button", { name: /פתיחת מפת כל הפחים/ }));
    fireEvent.click(screen.getByRole("button", { name: /ניווט לפח הקרוב/ }));
    view.unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });
});
