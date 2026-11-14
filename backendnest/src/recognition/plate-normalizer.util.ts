export class PlateNormalizer {
  /**
   * Normalizes an OCR license plate string.
   * Examples:
   *  "AA-12345" -> "AA12345"
   *  "AA 12345" -> "AA12345"
   *  "3-AA-12345" -> "3AA12345"
   *  "aa12345" -> "AA12345"
   */
  static normalize(plate: string): string {
    if (!plate) return '';

    // Convert to uppercase
    let normalized = plate.toUpperCase().trim();

    // Remove all non-alphanumeric characters (dashes, spaces, dots, slashes)
    normalized = normalized.replace(/[^A-Z0-9]/g, '');

    // Correct common OCR confusions if length matches expected patterns
    // e.g. 'O' substituted for '0' in numeric portion
    if (normalized.length >= 5) {
      const prefix = normalized.slice(0, 2);
      const rest = normalized.slice(2);

      // If rest has 'O' or 'I' or 'S' or 'Z', replace with numbers '0', '1', '5', '2'
      const cleanedRest = rest
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/S/g, '5')
        .replace(/Z/g, '2');

      normalized = prefix + cleanedRest;
    }

    return normalized;
  }
}
