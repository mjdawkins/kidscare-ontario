import { prisma } from "./db/prisma";
import { normalizePostalCode, extractFSA, isValidPostalCode } from "./utils";

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Look up coordinates for a Canadian postal code.
 * Falls back to FSA centroid if exact match fails.
 * Returns null if the postal code is completely unknown.
 */
export async function postalCodeToCoords(
  postalCode: string
): Promise<Coordinates | null> {
  if (!isValidPostalCode(postalCode)) {
    return null;
  }

  const normalized = normalizePostalCode(postalCode);

  // Try exact match
  const exact = await prisma.postalCode.findUnique({
    where: { postalCode: normalized },
    select: { lat: true, lng: true },
  });

  if (exact) {
    return { lat: exact.lat, lng: exact.lng };
  }

  // Fall back to FSA centroid (first 3 chars)
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
