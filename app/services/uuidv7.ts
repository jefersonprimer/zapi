/**
 * Generates a standard-compliant, time-ordered UUIDv7.
 * UUIDv7 structure:
 * - 48 bits: Timestamp (milliseconds since epoch)
 * - 4 bits: Version (0111 = 7)
 * - 12 bits: Sequence / Random
 * - 2 bits: Variant (10 = RFC 4122)
 * - 62 bits: Random
 */
export function generateUUIDv7(): string {
  const now = Date.now();

  // 48-bit timestamp as hex (12 hex digits)
  const timestampHex = now.toString(16).padStart(12, "0");

  // 4 bits version (7) + 12 bits random (3 hex digits)
  const random1 = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
  const verAndRand = "7" + random1;

  // 2 bits variant (10 -> 8, 9, a, or b in hex) + 62 bits random (15 hex digits)
  const variantDigit = (8 + Math.floor(Math.random() * 4)).toString(16);
  const random2 = Array.from({ length: 15 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  const varAndRand = variantDigit + random2;

  return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-${verAndRand}-${varAndRand.slice(0, 4)}-${varAndRand.slice(4)}`;
}
