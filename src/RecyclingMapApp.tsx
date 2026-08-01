import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocationDetails, type RelativePosition } from "@/components/LocationDetails";
import { MapHeader } from "@/components/MapHeader";
import { RecyclingHome } from "@/components/RecyclingHome";
import { MapViewport } from "@/MapViewport";
import type {
  GeolocationStatus,
  Locale,
  RecyclingCatalog,
  UserLocation,
} from "@/data/types";
import { useDeviceHeading } from "@/hooks/useDeviceHeading";
import { appCopy, geolocationErrorMessage } from "@/i18n";
import { distanceMeters, initialBearing, nearestLocation } from "@/lib/geo";

interface RecyclingMapAppProps {
  catalog: RecyclingCatalog;
}

const geolocationOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 5_000,
};

function mapIdFromHash(categories: RecyclingCatalog["categories"]): string | null {
  const mapId = new URLSearchParams(window.location.hash.slice(1)).get("map");
  if (mapId === "all") return mapId;
  return categories.some(({ id }) => id === mapId) ? mapId : null;
}

export function RecyclingMapApp({ catalog }: RecyclingMapAppProps) {
  const [locale, setLocale] = useState<Locale>("he");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [view, setView] = useState<"home" | "map">("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [fitRequest, setFitRequest] = useState(0);
  const [centerOnUserRequest, setCenterOnUserRequest] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const hasReceivedLocationRef = useRef(false);
  const deviceHeading = useDeviceHeading();
  const copy = appCopy[locale];

  const categoryById = useMemo(
    () => new Map(catalog.categories.map((category) => [category.id, category])),
    [catalog.categories],
  );
  const locationById = useMemo(
    () => new Map(catalog.locations.map((location) => [location.id, location])),
    [catalog.locations],
  );
  const visibleLocations = useMemo(
    () =>
      selectedCategoryId === "all"
        ? catalog.locations
        : catalog.locations.filter(
            (location) => location.categoryId === selectedCategoryId,
          ),
    [catalog.locations, selectedCategoryId],
  );

  const selectedFilterCategory =
    selectedCategoryId === "all"
      ? null
      : (categoryById.get(selectedCategoryId) ?? null);
  const selectedMapTitle = selectedFilterCategory?.label[locale] ?? copy.all;
  const selectedLocation = selectedId ? (locationById.get(selectedId) ?? null) : null;
  const selectedCategory = selectedLocation
    ? (categoryById.get(selectedLocation.categoryId) ?? null)
    : null;

  const relativePosition = useMemo<RelativePosition | null>(() => {
    if (!selectedLocation || !userLocation) return null;
    const bearing = initialBearing(userLocation, selectedLocation);
    return {
      distance: distanceMeters(userLocation, selectedLocation),
      bearing,
    };
  }, [selectedLocation, userLocation]);
  const nearestVisibleLocation = useMemo(
    () => (userLocation ? nearestLocation(userLocation, visibleLocations) : null),
    [userLocation, visibleLocations],
  );

  useEffect(() => {
    const syncViewFromHistory = () => {
      const mapId = mapIdFromHash(catalog.categories);
      if (mapId) {
        setSelectedCategoryId(mapId);
        setSelectedId(null);
        setView("map");
        return;
      }

      setSelectedId(null);
      setView("home");
    };

    syncViewFromHistory();
    window.addEventListener("popstate", syncViewFromHistory);
    window.addEventListener("hashchange", syncViewFromHistory);
    return () => {
      window.removeEventListener("popstate", syncViewFromHistory);
      window.removeEventListener("hashchange", syncViewFromHistory);
    };
  }, [catalog.categories]);

  const stopLocationWatch = useCallback(() => {
    const watchId = watchIdRef.current;
    if (watchId === null) return;
    navigator.geolocation?.clearWatch(watchId);
    watchIdRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopLocationWatch();
  }, [stopLocationWatch]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
    document.title = `${copy.title} | ${copy.campus}`;
  }, [copy.campus, copy.title, locale]);

  const requestLocation = useCallback(
    (selectNearest: boolean) => {
      const geolocation = navigator.geolocation;
      if (!geolocation) {
        setGeolocationStatus("unsupported");
        return;
      }

      if (userLocation) {
        if (selectNearest) {
          const nearest = nearestLocation(userLocation, visibleLocations);
          if (nearest) setSelectedId(nearest.id);
        }
        setCenterOnUserRequest((value) => value + 1);
        return;
      }
      if (watchIdRef.current !== null) return;

      hasReceivedLocationRef.current = false;
      setGeolocationStatus("locating");
      let pendingWatchId: number | null = null;
      let failedSynchronously = false;

      pendingWatchId = geolocation.watchPosition(
        (position) => {
          const currentLocation: UserLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setUserLocation(currentLocation);
          setGeolocationStatus("active");
          if (hasReceivedLocationRef.current) return;

          hasReceivedLocationRef.current = true;
          if (selectNearest) {
            const nearest = nearestLocation(currentLocation, visibleLocations);
            if (nearest) setSelectedId(nearest.id);
          }
          setCenterOnUserRequest((value) => value + 1);
        },
        (error) => {
          failedSynchronously = pendingWatchId === null;
          const activeWatchId = watchIdRef.current ?? pendingWatchId;
          if (activeWatchId !== null) geolocation.clearWatch(activeWatchId);
          watchIdRef.current = null;
          setUserLocation(null);

          if (error.code === error.PERMISSION_DENIED) {
            setGeolocationStatus("denied");
          } else if (error.code === error.TIMEOUT) {
            setGeolocationStatus("timeout");
          } else {
            setGeolocationStatus("unavailable");
          }
        },
        geolocationOptions,
      );

      if (failedSynchronously) {
        geolocation.clearWatch(pendingWatchId);
      } else {
        watchIdRef.current = pendingWatchId;
      }
    },
    [userLocation, visibleLocations],
  );

  function openMap(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setSelectedId(null);
    setFitRequest((value) => value + 1);
    setView("map");
    window.history.pushState({ recyclingMap: categoryId }, "", `#map=${categoryId}`);
  }

  function returnHome() {
    setSelectedId(null);
    setView("home");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  if (view === "home") {
    return (
      <RecyclingHome
        catalog={catalog}
        locale={locale}
        onLocaleChange={setLocale}
        onOpenMap={openMap}
      />
    );
  }

  const locationError = geolocationErrorMessage(geolocationStatus, locale);

  function startNavigation(selectNearest: boolean) {
    void deviceHeading.start();
    requestLocation(selectNearest);
  }

  return (
    <main
      className={`app-shell ${selectedLocation ? "has-selection" : ""}`}
      lang={locale}
      dir={locale === "he" ? "rtl" : "ltr"}
    >
      <MapHeader
        locale={locale}
        mapTitle={selectedMapTitle}
        locationCount={visibleLocations.length}
        onBack={returnHome}
        onLocaleChange={setLocale}
      />

      <MapViewport
        locations={visibleLocations}
        categories={catalog.categories}
        locale={locale}
        selectedId={selectedId}
        userLocation={userLocation}
        fitRequest={fitRequest}
        centerOnUserRequest={centerOnUserRequest}
        onSelect={setSelectedId}
      />

      <button
        type="button"
        className="navigation-cta"
        onClick={() => startNavigation(true)}
        disabled={geolocationStatus === "locating"}
      >
        <span className="navigation-cta-icon" aria-hidden="true">
          ⌖
        </span>
        <span>
          <strong>
            {geolocationStatus === "locating" ? copy.locating : copy.navigateNearest}
          </strong>
          <small>{copy.navigateHint}</small>
        </span>
      </button>

      {locationError ? (
        <div className="status-banner" role="status">
          <span>{locationError}</span>
          <button type="button" onClick={() => startNavigation(true)}>
            {copy.retry}
          </button>
        </div>
      ) : null}

      {selectedLocation && selectedCategory ? (
        <LocationDetails
          locale={locale}
          location={selectedLocation}
          category={selectedCategory}
          nearestLocationId={nearestVisibleLocation?.id ?? null}
          relativePosition={relativePosition}
          deviceHeading={deviceHeading.heading}
          deviceHeadingStatus={deviceHeading.status}
          userLocation={userLocation}
          geolocationStatus={geolocationStatus}
          onClose={() => setSelectedId(null)}
          onRequestLocation={() => startNavigation(false)}
        />
      ) : null}
    </main>
  );
}
