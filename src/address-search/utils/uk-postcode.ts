export const UK_POSTCODE_PATTERN = /^(?:GIR 0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRVWXY]?) [0-9][ABD-HJLNP-UW-Z]{2})$/;

export function normalizeUkPostcode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkPostcode(value: string): boolean {
  return UK_POSTCODE_PATTERN.test(normalizeUkPostcode(value));
}
