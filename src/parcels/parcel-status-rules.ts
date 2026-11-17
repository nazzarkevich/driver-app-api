import { BadRequestException, ConflictException } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
export const parcelActiveStages: DeliveryStatus[] = [
  DeliveryStatus.AwaitingPickup,
  DeliveryStatus.PickedUp,
  DeliveryStatus.AtOriginWarehouse,
  DeliveryStatus.InTransit,
  DeliveryStatus.AtDestinationWarehouse,
  DeliveryStatus.AtNovaPostWarehouse,
  DeliveryStatus.Delivered,
];
export function isNovaPostDestination(parcel: {
  destinationSnapshot?: unknown;
  destinationType?: string | null;
  novaPostWarehouseId?: number | null;
  customerNovaPostAddressId?: number | null;
}) {
  const snapshot = parcel.destinationSnapshot;
  if (snapshot && typeof snapshot === 'object' && 'type' in snapshot)
    return snapshot.type === 'NovaPostWarehouse';
  if (parcel.destinationType)
    return parcel.destinationType === 'NovaPostWarehouse';
  return !!(parcel.novaPostWarehouseId || parcel.customerNovaPostAddressId);
}
export function trackingDigits(value: string) {
  return value.replace(/\D/g, '');
}
export function validateNovaTracking(value?: string | null): string {
  const digits = trackingDigits(value ?? '');
  if (digits.length !== 14)
    throw new BadRequestException({
      code: 'INVALID_NOVA_POST_TRACKING',
      message: 'Nova Post tracking number must contain 14 digits',
    });
  return digits;
}
export function statusConflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}
export function requireProblemReason(reason?: string | null) {
  const value = reason?.trim();
  if (!value || value.length > 1000)
    throw new BadRequestException({
      code: 'PARCEL_REASON_REQUIRED',
      message: 'A reason of 1 to 1000 characters is required',
    });
  return value;
}
