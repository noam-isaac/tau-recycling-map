import { useCallback, useEffect, useRef, useState } from "react";

export type DeviceHeadingStatus =
  "idle" | "requesting" | "listening" | "active" | "denied" | "unavailable";

interface CompassOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

type PermissionAwareDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"denied" | "granted">;
};

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function headingFromEvent(event: CompassOrientationEvent): number | null {
  if (
    typeof event.webkitCompassHeading === "number" &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return normalizeDegrees(event.webkitCompassHeading);
  }

  if (
    event.absolute &&
    typeof event.alpha === "number" &&
    Number.isFinite(event.alpha)
  ) {
    return normalizeDegrees(360 - event.alpha);
  }

  return null;
}

export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<DeviceHeadingStatus>("idle");
  const listeningRef = useRef(false);
  const pendingRequestRef = useRef<Promise<void> | null>(null);

  const handleOrientation = useCallback((event: Event) => {
    const nextHeading = headingFromEvent(event as CompassOrientationEvent);
    if (nextHeading === null) return;

    setHeading(nextHeading);
    setStatus("active");
  }, []);

  useEffect(() => {
    return () => {
      if (!listeningRef.current) return;

      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      listeningRef.current = false;
    };
  }, [handleOrientation]);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    listeningRef.current = true;
    setStatus("listening");
  }, [handleOrientation]);

  const start = useCallback((): Promise<void> => {
    if (listeningRef.current) return Promise.resolve();
    if (pendingRequestRef.current) return pendingRequestRef.current;

    const request = (async () => {
      if (typeof window.DeviceOrientationEvent === "undefined") {
        setStatus("unavailable");
        return;
      }

      const orientationEvent =
        window.DeviceOrientationEvent as PermissionAwareDeviceOrientationEvent;
      if (typeof orientationEvent.requestPermission === "function") {
        setStatus("requesting");
        try {
          const permission = await orientationEvent.requestPermission();
          if (permission !== "granted") {
            setStatus("denied");
            return;
          }
        } catch {
          setStatus("denied");
          return;
        }
      }

      startListening();
    })();

    pendingRequestRef.current = request.finally(() => {
      pendingRequestRef.current = null;
    });
    return pendingRequestRef.current;
  }, [startListening]);

  return { heading, start, status };
}
