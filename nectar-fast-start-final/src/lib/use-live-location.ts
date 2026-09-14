import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishMyLocation } from "@/lib/geo.functions";
import { LOCATION_PUBLISH_INTERVAL_MS } from "@/lib/geo-schemas";

export type Coords = { lat: number; lng: number; accuracy: number | null };

/**
 * Browser geolocation for the CRM map.
 *
 * `locate()` is an on-demand read (used by the "Use my location" button).
 * When `share` is true the position is also published to the team map, at
 * most once a minute, and only while this component is mounted — nothing is
 * tracked in the background and no history is stored.
 */
export function useLiveLocation(share: boolean) {
  const publish = useServerFn(publishMyLocation);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const lastPublishRef = useRef(0);
  const shareRef = useRef(share);
  shareRef.current = share;

  const handle = useCallback(
    (pos: GeolocationPosition) => {
      const next = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
      };
      setCoords(next);
      setError(null);

      if (!shareRef.current) return;
      const now = Date.now();
      if (now - lastPublishRef.current < LOCATION_PUBLISH_INTERVAL_MS) return;
      lastPublishRef.current = now;
      void publish({
        data: { lat: next.lat, lng: next.lng, accuracyMeters: next.accuracy },
      }).catch(() => {
        /* a dropped position update is not worth interrupting the rep */
      });
    },
    [publish],
  );

  const fail = useCallback((err: GeolocationPositionError) => {
    setLocating(false);
    setError(
      err.code === err.PERMISSION_DENIED
        ? "Location permission denied. Enable it in your browser settings to use the map."
        : "Couldn't get your location. Try again outdoors or with GPS on.",
    );
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This device doesn't support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        handle(pos);
      },
      fail,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, [handle, fail]);

  // Continuous watch only while sharing is on and the app is open.
  useEffect(() => {
    if (!share || typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(handle, fail, {
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 30000,
    });
    return () => navigator.geolocation.clearWatch(id);
  }, [share, handle, fail]);

  return { coords, error, locating, locate };
}
