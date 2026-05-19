/**
 * OpenAQ air-quality live fetcher.
 *
 * Strategy:
 *   1. Pull all PM2.5 monitoring locations in Nepal once (cached).
 *   2. For each facility coordinate, find the nearest location.
 *   3. For each nearest location, pull the most-recent PM2.5 measurement.
 *
 * Endpoints used:
 *   GET /api/v1/data-sources/openaq/locations/?country_codes=NP&coordinates={lon},{lat}&radius=200
 *   GET /api/v1/data-sources/openaq/measurements/?location_id={id}&parameter_name=pm25&ordering=-measured_at&page_size=1
 */

import { apiFetch, apiFetchAll } from "@/lib/api/client";

type OpenAqLocation = {
  id?: number;
  openaq_id?: number;
  name?: string;
  country_code?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  datetime_last?: string;
};

type OpenAqMeasurement = {
  id?: number;
  parameter_name?: string;
  value?: number | string;
  unit?: string;
  measured_at?: string;
  location?: number;
  location_name?: string;
};

export type FacilityAirQuality = {
  pm25: number;
  unit: string;
  readingDate: string;
  stationName: string;
  stationDistanceKm: number | null;
};

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

const LOC_TTL_MS = 6 * 60 * 60 * 1000; // 6h — location list is slow-changing
const MEAS_TTL_MS = 30 * 60 * 1000;    // 30min — measurements change daily

let nplLocationCache:
  | { value: OpenAqLocation[]; fetchedAt: number }
  | null = null;

type FacilityKey = string; // `${lat},${lng}`
const facilityCache = new Map<
  FacilityKey,
  { value: FacilityAirQuality | null; fetchedAt: number }
>();

function key(lat: number, lng: number): FacilityKey {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function distKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toNumeric(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Location list (Nepal, PM2.5-capable)
// ---------------------------------------------------------------------------

async function getNepalLocations(token: string): Promise<OpenAqLocation[]> {
  if (
    nplLocationCache &&
    Date.now() - nplLocationCache.fetchedAt < LOC_TTL_MS
  ) {
    return nplLocationCache.value;
  }
  const { results } = await apiFetchAll<OpenAqLocation>(
    "/api/v1/data-sources/openaq/locations/",
    {
      params: {
        country_codes: "NP",
        parameter_type: "pollutant",
        page_size: 500,
      },
      token,
      maxPages: 4,
    }
  );
  nplLocationCache = { value: results, fetchedAt: Date.now() };
  return results;
}

// ---------------------------------------------------------------------------
// Latest PM2.5 for a location
// ---------------------------------------------------------------------------

async function fetchLatestPm25(
  locationId: number,
  token: string
): Promise<OpenAqMeasurement | null> {
  type MeasResponse = { results?: OpenAqMeasurement[]; count?: number };
  try {
    const res = await apiFetch<MeasResponse>(
      "/api/v1/data-sources/openaq/measurements/",
      {
        params: {
          location_id: locationId,
          parameter_name: "pm25",
          ordering: "-measured_at",
          page_size: 1,
        },
        token,
      }
    );
    return res.results?.[0] ?? null;
  } catch (err) {
    console.warn(
      `OpenAQ measurement fetch failed for location ${locationId}: ${(err as Error).message}`
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public: find AQ near a facility
// ---------------------------------------------------------------------------

export async function getFacilityAirQuality(
  lat: number,
  lng: number,
  token: string
): Promise<FacilityAirQuality | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const k = key(lat, lng);
  const cached = facilityCache.get(k);
  if (cached && Date.now() - cached.fetchedAt < MEAS_TTL_MS) {
    return cached.value;
  }

  const locations = await getNepalLocations(token);
  if (locations.length === 0) {
    facilityCache.set(k, { value: null, fetchedAt: Date.now() });
    return null;
  }

  // Pick the nearest location with valid coordinates.
  let nearest: { loc: OpenAqLocation; km: number } | null = null;
  for (const loc of locations) {
    const ll = loc.coordinates;
    const la = ll?.latitude;
    const ln = ll?.longitude;
    if (la == null || ln == null) continue;
    const km = distKm({ lat, lng }, { lat: la, lng: ln });
    if (!nearest || km < nearest.km) nearest = { loc, km };
  }
  if (!nearest || !nearest.loc.id) {
    facilityCache.set(k, { value: null, fetchedAt: Date.now() });
    return null;
  }

  const meas = await fetchLatestPm25(nearest.loc.id, token);
  if (!meas || meas.value == null) {
    facilityCache.set(k, { value: null, fetchedAt: Date.now() });
    return null;
  }

  const out: FacilityAirQuality = {
    pm25: Math.round(toNumeric(meas.value)),
    unit: meas.unit ?? "µg/m³",
    readingDate: (meas.measured_at ?? "").slice(0, 10),
    stationName: nearest.loc.name ?? `OpenAQ #${nearest.loc.openaq_id}`,
    stationDistanceKm: Math.round(nearest.km * 10) / 10,
  };
  facilityCache.set(k, { value: out, fetchedAt: Date.now() });
  return out;
}

/** Pre-populate AQ for a batch of facilities — used in the SSR slice builder. */
export async function batchGetAirQuality(
  points: Array<{ lat: number; lng: number }>,
  token: string,
  concurrency = 4
): Promise<Map<string, FacilityAirQuality | null>> {
  const out = new Map<string, FacilityAirQuality | null>();
  const queue = [...points];
  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      if (!p) return;
      const aq = await getFacilityAirQuality(p.lat, p.lng, token);
      out.set(key(p.lat, p.lng), aq);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}
