export interface DeviceOrientationReading {
  absolute: boolean;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  webkitCompassAccuracy?: number;
  webkitCompassHeading?: number;
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function headingFromAbsoluteOrientation(
  alpha: number,
  beta: number | null,
  gamma: number | null,
): number {
  if (beta === null || gamma === null) return normalizeDegrees(360 - alpha);

  const alphaRadians = degreesToRadians(alpha);
  const betaRadians = degreesToRadians(beta);
  const gammaRadians = degreesToRadians(gamma);
  const cosineGamma = Math.cos(gammaRadians);
  const cosineAlpha = Math.cos(alphaRadians);
  const sineBeta = Math.sin(betaRadians);
  const sineGamma = Math.sin(gammaRadians);
  const sineAlpha = Math.sin(alphaRadians);
  const horizontalX = -cosineAlpha * sineGamma - sineAlpha * sineBeta * cosineGamma;
  const horizontalY = -sineAlpha * sineGamma + cosineAlpha * sineBeta * cosineGamma;

  if (Math.hypot(horizontalX, horizontalY) < Number.EPSILON) {
    return normalizeDegrees(360 - alpha);
  }

  return normalizeDegrees(radiansToDegrees(Math.atan2(horizontalX, horizontalY)));
}

export function headingFromOrientation(
  reading: DeviceOrientationReading,
): number | null {
  const safariHeading = reading.webkitCompassHeading;
  const safariAccuracy = reading.webkitCompassAccuracy;
  if (
    typeof safariHeading === "number" &&
    Number.isFinite(safariHeading) &&
    (typeof safariAccuracy !== "number" || safariAccuracy >= 0)
  ) {
    return normalizeDegrees(safariHeading);
  }

  if (
    !reading.absolute ||
    typeof reading.alpha !== "number" ||
    !Number.isFinite(reading.alpha)
  ) {
    return null;
  }

  return headingFromAbsoluteOrientation(reading.alpha, reading.beta, reading.gamma);
}
