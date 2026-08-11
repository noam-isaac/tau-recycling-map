import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type {
  GeolocationStatus,
  Locale,
  RecyclingCategory,
  RecyclingLocation,
  UserLocation,
} from "@/data/types";
import type { DeviceHeadingStatus } from "@/hooks/useDeviceHeading";
import { appCopy } from "@/i18n";
import { formatDistance, googleWalkingDirectionsUrl, relativeBearing } from "@/lib/geo";

const indoorPattern = /חדר|קומה|כיתה|אולם|סטודיו|מעליות|ספרייה|בניין/;

export interface RelativePosition {
  distance: number;
  bearing: number;
}

interface LocationPhotoProps {
  alt: string;
  closeLabel: string;
  dialogLabel: string;
  openLabel: string;
  src: string;
}

function LocationPhoto({
  alt,
  closeLabel,
  dialogLabel,
  openLabel,
  src,
}: LocationPhotoProps) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbnailButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;

    const dialog = dialogRef.current;
    const thumbnailButton = thumbnailButtonRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (dialog.open) {
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      }
      thumbnailButton?.focus();
    };
  }, [expanded]);

  if (failed) return null;

  return (
    <>
      <button
        ref={thumbnailButtonRef}
        type="button"
        className="detail-photo"
        data-testid="location-photo"
        aria-haspopup="dialog"
        aria-label={openLabel}
        onClick={() => setExpanded(true)}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
        <span className="detail-photo-action" aria-hidden="true">
          <span>⛶</span>
          {openLabel}
        </span>
      </button>

      {expanded
        ? createPortal(
            <dialog
              ref={dialogRef}
              className="photo-lightbox"
              aria-label={dialogLabel}
              onCancel={(event) => {
                event.preventDefault();
                setExpanded(false);
              }}
              onClick={(event) => {
                if (event.target === event.currentTarget) setExpanded(false);
              }}
            >
              <button
                ref={closeButtonRef}
                type="button"
                className="photo-lightbox-close"
                aria-label={closeLabel}
                onClick={() => setExpanded(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
              <img
                className="photo-lightbox-image"
                src={src}
                alt={alt}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => {
                  setExpanded(false);
                  setFailed(true);
                }}
              />
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}

interface LocationDetailsProps {
  locale: Locale;
  location: RecyclingLocation;
  category: RecyclingCategory;
  nearestLocationId: string | null;
  relativePosition: RelativePosition | null;
  deviceHeading: number | null;
  deviceHeadingStatus: DeviceHeadingStatus;
  userLocation: UserLocation | null;
  geolocationStatus: GeolocationStatus;
  onClose: () => void;
  onRequestLocation: () => void;
}

export function LocationDetails({
  locale,
  location,
  category,
  nearestLocationId,
  relativePosition,
  deviceHeading,
  deviceHeadingStatus,
  userLocation,
  geolocationStatus,
  onClose,
  onRequestLocation,
}: LocationDetailsProps) {
  const copy = appCopy[locale];
  const hasHebrewDescription = location.descriptionHe !== null;
  const arrowRotation =
    relativePosition && deviceHeading !== null
      ? relativeBearing(relativePosition.bearing, deviceHeading)
      : null;
  const directionStatus =
    deviceHeading !== null
      ? copy.directionLive
      : deviceHeadingStatus === "listening" || deviceHeadingStatus === "requesting"
        ? copy.directionStarting
        : copy.directionUnavailable;

  return (
    <aside className="detail-panel" aria-label={copy.selected}>
      <button
        type="button"
        className="detail-close"
        aria-label={copy.close}
        onClick={onClose}
      >
        ×
      </button>
      <div className="detail-heading">
        <span
          className="detail-icon"
          aria-hidden="true"
          style={{ "--category-color": category.color } as CSSProperties}
        >
          <img src={category.icon} alt="" />
        </span>
        <div>
          <span className="detail-eyebrow">{copy.selected}</span>
          <h2>{category.label[locale]}</h2>
        </div>
      </div>

      {nearestLocationId === location.id ? (
        <div className="nearest-badge">
          <span aria-hidden="true">⌖</span>
          {copy.nearest}
        </div>
      ) : null}

      {location.imageUrl ? (
        <LocationPhoto
          key={location.imageUrl}
          src={location.imageUrl}
          alt={`${copy.locationPhoto}: ${category.label[locale]}`}
          openLabel={copy.viewPhoto}
          dialogLabel={copy.enlargedPhoto}
          closeLabel={copy.closePhoto}
        />
      ) : null}

      <p
        className="detail-description"
        lang={hasHebrewDescription ? "he" : locale}
        dir="auto"
      >
        {location.descriptionHe ?? copy.noDescription}
      </p>

      {location.descriptionHe && indoorPattern.test(location.descriptionHe) ? (
        <p className="indoor-note">
          <span aria-hidden="true">↳</span>
          {copy.indoor}
        </p>
      ) : null}

      {relativePosition ? (
        <div
          className={`relative-card ${arrowRotation === null ? "distance-only" : ""}`}
        >
          {arrowRotation !== null ? (
            <div className="direction-display">
              <div
                className="direction-arrow-rotation"
                data-testid="direction-arrow"
                role="img"
                aria-label={copy.direction}
                style={{ transform: `rotate(${arrowRotation}deg)` }}
              >
                <svg className="direction-arrow" aria-hidden="true" viewBox="0 0 64 64">
                  <path d="M32 4 52 55 32 45 12 55 32 4Z" />
                </svg>
              </div>
            </div>
          ) : null}
          <div className="distance-readout">
            <span>{copy.distance}</span>
            <strong aria-live="polite">
              {formatDistance(relativePosition.distance, locale)}
            </strong>
          </div>
          <p className="direction-status" aria-live="polite">
            {directionStatus}
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="use-location"
          disabled={geolocationStatus === "locating"}
          onClick={onRequestLocation}
        >
          <span aria-hidden="true">◎</span>
          {geolocationStatus === "locating" ? copy.locating : copy.useLocation}
        </button>
      )}

      {userLocation && userLocation.accuracy > 100 ? (
        <p className="accuracy-note">
          {copy.accuracy}: {formatDistance(userLocation.accuracy, locale)}
        </p>
      ) : null}

      <a
        className="directions-button"
        href={googleWalkingDirectionsUrl(location)}
        target="_blank"
        rel="noreferrer"
      >
        <span aria-hidden="true">↗</span>
        {copy.directions}
      </a>
    </aside>
  );
}
