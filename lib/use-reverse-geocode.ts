"use client";

import { useEffect, useState } from "react";

export interface ReverseGeocodeResult {
  city: string | null;
  country: string | null;
}

const CACHE_PREFIX = "geo:v1:";

function cacheKey(lat: number, lng: number) {
  // Round to ~110m so nearby photos share a cache entry
  return `${CACHE_PREFIX}${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Reverse-geocodes coordinates to city/country using BigDataCloud's free
 * client-side endpoint (no key required, no rate-limit for reasonable use).
 * Results are cached in localStorage so repeat views are instant and offline.
 */
export function useReverseGeocode(
  lat: number | undefined,
  lng: number | undefined
): ReverseGeocodeResult | null {
  const [result, setResult] = useState<ReverseGeocodeResult | null>(null);

  useEffect(() => {
    setResult(null);
    if (lat == null || lng == null) return;

    let cancelled = false;
    const key = cacheKey(lat, lng);

    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        setResult(JSON.parse(cached));
        return;
      }
    } catch {
      // ignore localStorage failures
    }

    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const out: ReverseGeocodeResult = {
          city:
            data.city ||
            data.locality ||
            data.principalSubdivision ||
            null,
          country: data.countryName || null,
        };
        try {
          localStorage.setItem(key, JSON.stringify(out));
        } catch {
          // quota or disabled — ignore
        }
        setResult(out);
      })
      .catch(() => {
        // network failure — leave result null, coords still display
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return result;
}
