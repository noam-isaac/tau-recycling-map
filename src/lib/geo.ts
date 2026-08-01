import type { Coordinates, Locale } from "@/data/types";

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function initialBearing(from: Coordinates, to: Coordinates): number {
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);

  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function relativeBearing(targetBearing: number, deviceHeading: number): number {
  return (((targetBearing - deviceHeading) % 360) + 360) % 360;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Cardinal = (typeof CARDINALS)[number];

export function bearingCardinal(bearing: number): Cardinal {
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  const cardinalIndex = Math.round(normalizedBearing / 45) % CARDINALS.length;
  return CARDINALS[cardinalIndex] ?? "N";
}

export function formatDistance(distance: number, locale: Locale): string {
  if (distance < 1000) {
    const meters = Math.round(distance / 5) * 5;
    return locale === "he" ? `${meters} מ׳` : `${meters} m`;
  }

  const kilometers = (distance / 1000).toFixed(distance < 10_000 ? 1 : 0);
  return locale === "he" ? `${kilometers} ק״מ` : `${kilometers} km`;
}

export function googleWalkingDirectionsUrl(to: Coordinates): string {
  const query = new URLSearchParams({
    api: "1",
    destination: `${to.lat},${to.lng}`,
    travelmode: "walking",
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

export function nearestLocation<T extends Coordinates>(
  from: Coordinates,
  locations: readonly T[],
): T | null {
  let nearest: T | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const location of locations) {
    const distance = distanceMeters(from, location);
    if (distance < nearestDistance) {
      nearest = location;
      nearestDistance = distance;
    }
  }

  return nearest;
}
