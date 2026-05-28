import { prisma } from "./db/prisma";
import { normalizePostalCode, extractFSA, isValidPostalCode } from "./utils";

export interface Coordinates {
  lat: number;
  lng: number;
}

// Rate-limit Nominatim to 1 request/second (usage policy)
let lastNominatimCall = 0;

async function geocodeViaNominatim(postalCode: string): Promise<Coordinates | null> {
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("postalcode", postalCode);
    url.searchParams.set("country", "Canada");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "KidsCareOntario/1.0 (kidscareontario.ca)",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.length) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);

    if (isNaN(lat) || isNaN(lng)) return null;

    // Cache in database so we never look it up again
    await prisma.postalCode.create({
      data: {
        postalCode,
        lat,
        lng,
        city: data[0].display_name?.split(",")[0]?.trim() ?? "",
        province: "ON",
      },
    }).catch(() => {
      // Duplicate key — another request already cached it, that's fine
    });

    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Look up coordinates for a Canadian postal code.
 *
 * Resolution order:
 * 1. Exact match in postal_codes table
 * 2. FSA-level fallback (first 3 chars)
 * 3. Nominatim geocoding API (free, cached forever)
 *
 * Returns null if all methods fail.
 */
export async function postalCodeToCoords(
  postalCode: string
): Promise<Coordinates | null> {
  if (!isValidPostalCode(postalCode)) {
    return null;
  }

  const normalized = normalizePostalCode(postalCode);

  // 1. Try exact match in our database
  const exact = await prisma.postalCode.findUnique({
    where: { postalCode: normalized },
    select: { lat: true, lng: true },
  });

  if (exact) {
    return { lat: exact.lat, lng: exact.lng };
  }

  // 2. Try Nominatim (free, no API key, 1 req/sec)
  // This also caches the result for future lookups
  const fromNominatim = await geocodeViaNominatim(normalized);
  if (fromNominatim) {
    return fromNominatim;
  }

  // 3. Fall back to FSA centroid
  const fsa = extractFSA(normalized);
  const fsaMatch = await prisma.postalCode.findFirst({
    where: { postalCode: { startsWith: fsa } },
    select: { lat: true, lng: true },
  });

  if (fsaMatch) {
    return { lat: fsaMatch.lat, lng: fsaMatch.lng };
  }

  return null;
}
