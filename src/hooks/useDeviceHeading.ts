import { useCallback, useEffect, useRef, useState } from "react";
import { headingFromOrientation } from "@/lib/device-heading";

export type DeviceHeadingStatus =
  "idle" | "requesting" | "listening" | "active" | "denied" | "unavailable";

interface CompassOrientationEvent extends DeviceOrientationEvent {
  webkitCompassAccuracy?: number;
  webkitCompassHeading?: number;
}

type PermissionAwareDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission: (absolute?: boolean) => Promise<PermissionState>;
};

function hasWebKitCompassData(
  event: DeviceOrientationEvent,
): event is CompassOrientationEvent {
  return "webkitCompassHeading" in event;
}

function canRequestOrientationPermission(
  orientationEvent: typeof DeviceOrientationEvent,
): orientationEvent is PermissionAwareDeviceOrientationEvent {
  return "requestPermission" in orientationEvent;
}

const COMPASS_STARTUP_TIMEOUT_MS = 3_000;

export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<DeviceHeadingStatus>("idle");
  const listeningRef = useRef(false);
  const pendingRequestRef = useRef<Promise<void> | null>(null);
  const startupTimeoutRef = useRef<number | null>(null);

  const clearStartupTimeout = useCallback(() => {
    const timeoutId = startupTimeoutRef.current;
    if (timeoutId === null) return;
    window.clearTimeout(timeoutId);
    startupTimeoutRef.current = null;
  }, []);

  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      const webkitData = hasWebKitCompassData(event)
        ? {
            ...(typeof event.webkitCompassAccuracy === "number"
              ? { webkitCompassAccuracy: event.webkitCompassAccuracy }
              : {}),
            ...(typeof event.webkitCompassHeading === "number"
              ? { webkitCompassHeading: event.webkitCompassHeading }
              : {}),
          }
        : {};
      const nextHeading = headingFromOrientation({
        absolute: event.absolute,
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        ...webkitData,
      });
      if (nextHeading === null) return;

      clearStartupTimeout();
      setHeading(nextHeading);
      setStatus("active");
    },
    [clearStartupTimeout],
  );

  useEffect(() => {
    return () => {
      if (!listeningRef.current) return;

      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      clearStartupTimeout();
      listeningRef.current = false;
    };
  }, [clearStartupTimeout, handleOrientation]);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    listeningRef.current = true;
    setStatus("listening");
    clearStartupTimeout();
    startupTimeoutRef.current = window.setTimeout(() => {
      startupTimeoutRef.current = null;
      setStatus("unavailable");
    }, COMPASS_STARTUP_TIMEOUT_MS);
  }, [clearStartupTimeout, handleOrientation]);

  const start = useCallback((): Promise<void> => {
    if (listeningRef.current) return Promise.resolve();
    if (pendingRequestRef.current) return pendingRequestRef.current;

    const request = (async () => {
      if (typeof window.DeviceOrientationEvent === "undefined") {
        setStatus("unavailable");
        return;
      }

      const orientationEvent = window.DeviceOrientationEvent;
      if (canRequestOrientationPermission(orientationEvent)) {
        setStatus("requesting");
        try {
          const permission = await orientationEvent.requestPermission(true);
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
