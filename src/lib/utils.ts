/**
 * Normalize a Canadian postal code: strip spaces, uppercase.
 * "M5V 2T6" -> "M5V2T6"
 */
export function normalizePostalCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/**
 * Validate Canadian postal code format: A1A1A1
 */
export function isValidPostalCode(input: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/.test(input.replace(/\s+/g, ""));
}

/**
 * Extract FSA (first 3 characters) from postal code for fallback lookups.
 * "M5V2T6" -> "M5V"
 */
export function extractFSA(postalCode: string): string {
  return normalizePostalCode(postalCode).slice(0, 3);
}
