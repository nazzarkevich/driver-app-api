import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';

export function normalizePostcode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/\s/g, '').toUpperCase() || null;
}

export function trackingVerification(
  destination: Prisma.InputJsonValue,
  origin: Prisma.InputJsonValue,
) {
  const postcodeFrom = (snapshot: Prisma.InputJsonValue) =>
    normalizePostcode(
      typeof snapshot === 'object' &&
        snapshot !== null &&
        !Array.isArray(snapshot)
        ? (snapshot as Prisma.InputJsonObject).postcode
        : null,
    );
  const destinationPostcode = postcodeFrom(destination);
  const senderPostcode = postcodeFrom(origin);
  return {
    verificationPostcode: destinationPostcode ?? senderPostcode,
    verificationPostcodeSource: destinationPostcode
      ? 'destination'
      : senderPostcode
        ? 'sender'
        : null,
  };
}

export function hashTrackingValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function creationFingerprint(value: unknown): string {
  const canonicalize = (item: any): any => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .filter((key) => item[key] !== undefined)
          .map((key) => [key, canonicalize(item[key])]),
      );
    }
    return item;
  };
  return hashTrackingValue(JSON.stringify(canonicalize(value)));
}
