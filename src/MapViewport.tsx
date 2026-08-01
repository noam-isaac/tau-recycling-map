import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { Circle, Map as LeafletMap, Marker, MarkerClusterGroup } from "leaflet";
import { satelliteBasemap } from "@/config/basemap";
import type {
  Locale,
  RecyclingCategory,
  RecyclingLocation,
  UserLocation,
} from "@/data/types";
import { appCopy } from "@/i18n";

interface MapViewportProps {
  locations: readonly RecyclingLocation[];
  categories: readonly RecyclingCategory[];
  locale: Locale;
  selectedId: string | null;
  userLocation: UserLocation | null;
  fitRequest: number;
  centerOnUserRequest: number;
  onSelect: (locationId: string) => void;
}

const boundsPadding: [number, number] = [38, 38];
type LeafletNamespace = typeof import("leaflet");

let leafletModulePromise: Promise<LeafletNamespace> | null = null;

function loadLeaflet(): Promise<LeafletNamespace> {
  leafletModulePromise ??= import("leaflet").then(async ({ default: leaflet }) => {
    await import("leaflet.markercluster");
    return leaflet;
  });
  return leafletModulePromise;
}

function createMarkerElement(
  category: RecyclingCategory,
  isSelected: boolean,
): HTMLSpanElement {
  const marker = document.createElement("span");
  marker.className = `recycling-marker${isSelected ? " is-selected" : ""}`;
  marker.style.setProperty("--marker-color", category.color);

  const image = document.createElement("img");
  image.src = category.icon;
  image.alt = "";
  marker.append(image);
  return marker;
}

export function MapViewport({
  locations,
  categories,
  locale,
  selectedId,
  userLocation,
  fitRequest,
  centerOnUserRequest,
  onSelect,
}: MapViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const markerElementsRef = useRef(new Map<string, HTMLSpanElement>());
  const userLayersRef = useRef<{ accuracy: Circle; marker: Marker } | null>(null);
  const hasFitInitialBounds = useRef(false);
  const lastFitRequest = useRef(fitRequest);
  const lastCenterRequest = useRef(centerOnUserRequest);
  const [mapReady, setMapReady] = useState(false);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const onMarkerSelect = useEffectEvent(onSelect);
  const getSelectedId = useEffectEvent(() => selectedId);

  useEffect(() => {
    let cancelled = false;
    const markerElements = markerElementsRef.current;

    async function createMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [32.1133, 34.8044],
        zoom: 16,
        zoomControl: false,
        preferCanvas: true,
      });

      L.tileLayer(satelliteBasemap.tileUrl, {
        attribution: satelliteBasemap.attribution,
        maxZoom: satelliteBasemap.maxZoom,
      }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 34,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 19,
        removeOutsideVisibleBounds: true,
      });
      cluster.addTo(map);

      mapRef.current = map;
      clusterRef.current = cluster;
      setMapReady(true);
    }

    void createMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markerElements.clear();
      userLayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapContainer = mapRef.current?.getContainer();
    if (!mapContainer) return;
    const copy = appCopy[locale];
    const zoomIn = mapContainer.querySelector<HTMLAnchorElement>(
      ".leaflet-control-zoom-in",
    );
    const zoomOut = mapContainer.querySelector<HTMLAnchorElement>(
      ".leaflet-control-zoom-out",
    );
    for (const [control, label] of [
      [zoomIn, copy.zoomIn],
      [zoomOut, copy.zoomOut],
    ] as const) {
      if (!control) continue;
      control.title = label;
      control.setAttribute("aria-label", label);
    }
  }, [locale, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !clusterRef.current) return;
    const map = mapRef.current;
    const cluster = clusterRef.current;
    let cancelled = false;

    async function drawMarkers() {
      const L = await loadLeaflet();
      if (cancelled) return;
      cluster.clearLayers();
      markerElementsRef.current.clear();

      for (const location of locations) {
        const category = categoryById.get(location.categoryId);
        if (!category) continue;
        const label = category.label[locale];
        const isSelected = location.id === getSelectedId();
        const markerElement = createMarkerElement(category, isSelected);
        const icon = L.divIcon({
          className: "recycling-marker-wrapper",
          html: markerElement,
          iconSize: [42, 48],
          iconAnchor: [21, 45],
          tooltipAnchor: [0, -38],
        });

        const marker = L.marker([location.lat, location.lng], {
          icon,
          keyboard: true,
          title: label,
          alt: label,
          riseOnHover: true,
        });
        marker.bindTooltip(label, { direction: "top", offset: [0, -12] });
        marker.on("click", () => onMarkerSelect(location.id));
        cluster.addLayer(marker);
        markerElementsRef.current.set(location.id, markerElement);
      }

      if (!hasFitInitialBounds.current && locations.length > 0) {
        map.fitBounds(
          L.latLngBounds(
            locations.map(({ lat, lng }) => [lat, lng] as [number, number]),
          ),
          { padding: boundsPadding, maxZoom: 17 },
        );
        hasFitInitialBounds.current = true;
      }
    }

    void drawMarkers();
    return () => {
      cancelled = true;
    };
  }, [categoryById, locale, locations, mapReady]);

  useEffect(() => {
    for (const [locationId, markerElement] of markerElementsRef.current) {
      markerElement.classList.toggle("is-selected", locationId === selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || fitRequest === lastFitRequest.current) {
      return;
    }
    lastFitRequest.current = fitRequest;
    if (locations.length === 0) return;

    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled) return;
      mapRef.current?.fitBounds(
        L.latLngBounds(locations.map(({ lat, lng }) => [lat, lng] as [number, number])),
        { padding: boundsPadding, maxZoom: 17 },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [fitRequest, locations, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;

    async function drawUserLocation() {
      const map = mapRef.current;
      if (!map) return;
      const L = await loadLeaflet();
      if (cancelled) return;

      const existingLayers = userLayersRef.current;
      if (!userLocation) {
        if (existingLayers) {
          map.removeLayer(existingLayers.accuracy);
          map.removeLayer(existingLayers.marker);
          userLayersRef.current = null;
        }
        return;
      }

      if (existingLayers) {
        existingLayers.accuracy
          .setLatLng([userLocation.lat, userLocation.lng])
          .setRadius(userLocation.accuracy);
        existingLayers.marker.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const accuracy = L.circle([userLocation.lat, userLocation.lng], {
          radius: userLocation.accuracy,
          color: "#0b67d0",
          fillColor: "#3d98ff",
          fillOpacity: 0.14,
          weight: 1,
          interactive: false,
        }).addTo(map);
        const marker = L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({
            className: "user-marker-wrapper",
            html: '<span class="user-marker"><span></span></span>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          interactive: false,
        }).addTo(map);
        userLayersRef.current = { accuracy, marker };
      }

      if (centerOnUserRequest !== lastCenterRequest.current) {
        lastCenterRequest.current = centerOnUserRequest;
        const selectedLocation = locations.find(({ id }) => id === selectedId);
        if (selectedLocation) {
          map.fitBounds(
            L.latLngBounds([
              [userLocation.lat, userLocation.lng],
              [selectedLocation.lat, selectedLocation.lng],
            ]),
            { padding: [70, 70], maxZoom: 18 },
          );
        } else {
          map.setView(
            [userLocation.lat, userLocation.lng],
            Math.max(map.getZoom(), 17),
          );
        }
      }
    }

    void drawUserLocation();
    return () => {
      cancelled = true;
    };
  }, [centerOnUserRequest, locations, mapReady, selectedId, userLocation]);

  return (
    <div
      ref={containerRef}
      className="map-viewport"
      role="region"
      aria-label={appCopy[locale].mapLabel}
    />
  );
}
