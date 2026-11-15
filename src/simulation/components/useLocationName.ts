import { useEffect, useState } from "react";
import type { Location } from "../engine/types";

interface ResolvedPlace {
  /** The coordinates this label was looked up for. */
  key: string;
  name: string;
}

function coordinateKey(latitude: number | undefined, longitude: number | undefined): string {
  return latitude === undefined || longitude === undefined ? "" : `${latitude},${longitude}`;
}

/**
 * Reverse-geocodes the field's coordinates into a readable place label
 * ("Folsom, California") with the same Mapbox geocoding API the dashboard's
 * map already uses.
 *
 * Returns undefined until it resolves, and stays undefined without a token
 * or on any failure, so every caller must fall back to the coordinates
 * themselves. Pass null to skip the lookup entirely (nothing on screen needs
 * the label).
 */
export function useLocationName(location: Location | null | undefined): string | undefined {
  const [resolved, setResolved] = useState<ResolvedPlace | null>(null);
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const key = coordinateKey(latitude, longitude);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token || key === "") return;

    const controller = new AbortController();
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=place,region&limit=1`;

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Mapbox geocoding HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        // place_name is "Folsom, California, United States"; the first two
        // parts are the town and state a grower would recognize.
        const placeName: unknown = json?.features?.[0]?.place_name;
        if (typeof placeName !== "string" || placeName.length === 0) return;
        const name = placeName
          .split(",")
          .slice(0, 2)
          .map((part) => part.trim())
          .join(", ");
        setResolved({ key, name });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.warn("Reverse geocoding failed; showing coordinates instead:", error);
      });

    return () => controller.abort();
  }, [key, latitude, longitude]);

  // Comparing keys during render means a previous field's label is never
  // shown over new coordinates, without a second state update to clear it.
  return resolved?.key === key ? resolved.name : undefined;
}
