import type { GeoLocation } from "./cloudinary";

/**
 * Parse GPS coordinates from Cloudinary's image_metadata fields.
 * EXIF GPS values can come in several formats:
 *   - DMS string: "60 deg 23' 45.12\" N"
 *   - Decimal string: "60.395867"
 *   - Number
 * Combined with GPSLatitudeRef/GPSLongitudeRef ("N/S", "E/W") to determine sign.
 */
export function parseGpsFromExif(meta: Record<string, any> | undefined | null): GeoLocation | undefined {
  if (!meta) return undefined;

  const latRaw = meta.GPSLatitude;
  const lngRaw = meta.GPSLongitude;
  if (latRaw == null || lngRaw == null) return undefined;

  const lat = toDecimalDegrees(latRaw, meta.GPSLatitudeRef);
  const lng = toDecimalDegrees(lngRaw, meta.GPSLongitudeRef);
  if (lat == null || lng == null) return undefined;

  // Sanity check — reject obviously-bogus values
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  if (lat === 0 && lng === 0) return undefined;

  const altitude = parseAltitude(meta.GPSAltitude, meta.GPSAltitudeRef);

  return altitude != null ? { lat, lng, altitude } : { lat, lng };
}

function toDecimalDegrees(value: unknown, ref: unknown): number | null {
  let num: number | null = null;

  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    // DMS format: "60 deg 23' 45.12\""  or  "60° 23' 45.12\""
    const dms = value.match(/(\d+(?:\.\d+)?)\s*(?:deg|°)\s*(\d+(?:\.\d+)?)?\s*'?\s*(\d+(?:\.\d+)?)?\s*"?/i);
    if (dms) {
      const d = parseFloat(dms[1]);
      const m = dms[2] ? parseFloat(dms[2]) : 0;
      const s = dms[3] ? parseFloat(dms[3]) : 0;
      num = d + m / 60 + s / 3600;
    } else {
      // Plain decimal
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) num = parsed;
    }
  }

  if (num == null || Number.isNaN(num)) return null;

  const refStr = typeof ref === "string" ? ref.trim().toUpperCase() : "";
  if (refStr === "S" || refStr === "W") num = -num;

  return num;
}

function parseAltitude(value: unknown, ref: unknown): number | undefined {
  if (value == null) return undefined;
  let num: number | null = null;
  if (typeof value === "number") num = value;
  else if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) num = parsed;
  }
  if (num == null) return undefined;
  // Ref 1 = below sea level
  const refStr = typeof ref === "string" ? ref.trim() : String(ref ?? "");
  if (refStr === "1") num = -num;
  return num;
}
