import { isISO8601 } from 'class-validator';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliveryStatus, Prisma, UserType } from '@prisma/client';
import type { UserRequestType } from 'src/users/decorators/current-user.decorator';
import type { ParcelPickupDto } from './dtos/parcel-pickup.dto';

export const canAssignParcelPickup = (actor: UserRequestType) =>
  actor.isAdmin ||
  actor.isSuperAdmin ||
  actor.type === UserType.Manager ||
  actor.type === UserType.Moderator;

const invalid = (code: string, message: string): never => {
  throw new BadRequestException({ code, message });
};
const forbidden = (): never => {
  throw new ForbiddenException({
    code: 'PICKUP_COLLECTOR_FORBIDDEN',
    message: 'Cannot record pickup for this collector',
  });
};

export function pickupCollectorWhere(
  businessId: number,
  search?: string,
): Prisma.UserWhereInput {
  return {
    businessId,
    isBlocked: false,
    isDeleted: false,
    staffApprovalStatus: 'Approved',
    OR: [
      {
        type: UserType.InternationalDriver,
        driverProfile: { is: { isDeleted: false } },
      },
      {
        type: UserType.ParcelCourier,
        courierProfile: { is: { isDeleted: false } },
      },
    ],
    ...(search?.trim()
      ? {
          AND: [
            {
              OR: [
                { firstName: { contains: search.trim(), mode: 'insensitive' } },
                { lastName: { contains: search.trim(), mode: 'insensitive' } },
              ],
            },
          ],
        }
      : {}),
  };
}

export async function resolveParcelPickup(
  tx: Prisma.TransactionClient,
  actor: UserRequestType,
  pickup: ParcelPickupDto | undefined,
  inferSelf: boolean,
  self: { driverId?: number; courierId?: number },
  now: Date,
) {
  if (!pickup && !inferSelf) return null;
  const collector = pickup ? pickup.collector : { type: 'Self' as const };
  if (!collector || !['Self', 'Driver', 'Courier'].includes(collector.type))
    invalid('PICKUP_COLLECTOR_UNAVAILABLE', 'A pickup collector is required');
  let profile: { driverId?: number; courierId?: number; userId: number };
  if (collector.type === 'Self') {
    if (collector.profileId !== undefined)
      invalid(
        'PICKUP_COLLECTOR_UNAVAILABLE',
        'Self pickup cannot name another profile',
      );
    if (self.driverId && self.courierId) forbidden();
    if (!self.driverId && !self.courierId) {
      if (!canAssignParcelPickup(actor)) forbidden();
      const active = await tx.user.findFirst({
        where: {
          id: actor.id,
          businessId: actor.businessId,
          isBlocked: false,
          isDeleted: false,
          staffApprovalStatus: 'Approved',
        },
        select: { id: true },
      });
      if (!active) forbidden();
    }
    profile = { ...self, userId: actor.id };
  } else {
    if (!Number.isSafeInteger(collector.profileId) || collector.profileId <= 0)
      invalid(
        'PICKUP_COLLECTOR_UNAVAILABLE',
        'A valid collector profile is required',
      );
    const own = collector.type === 'Driver' ? self.driverId : self.courierId;
    if (!canAssignParcelPickup(actor) && collector.profileId !== own)
      forbidden();
    const user = await tx.user.findFirst({
      where: {
        ...pickupCollectorWhere(actor.businessId),
        type:
          collector.type === 'Driver'
            ? UserType.InternationalDriver
            : UserType.ParcelCourier,
        ...(collector.type === 'Driver'
          ? {
              driverProfile: {
                is: { id: collector.profileId, isDeleted: false },
              },
            }
          : {
              courierProfile: {
                is: { id: collector.profileId, isDeleted: false },
              },
            }),
      },
      select: {
        id: true,
        driverProfile: { select: { id: true } },
        courierProfile: { select: { id: true } },
      },
    });
    if (!user)
      invalid(
        'PICKUP_COLLECTOR_UNAVAILABLE',
        'Collector is no longer available in this business',
      );
    profile =
      collector.type === 'Driver'
        ? { driverId: user.driverProfile.id, userId: user.id }
        : { courierId: user.courierProfile.id, userId: user.id };
  }
  let pickedUpAt = now;
  if (pickup?.pickedUpAt !== undefined) {
    if (!canAssignParcelPickup(actor)) forbidden();
    if (
      typeof pickup.pickedUpAt !== 'string' ||
      !isISO8601(pickup.pickedUpAt, { strict: true, strictSeparator: true }) ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(pickup.pickedUpAt)
    )
      invalid('PICKUP_TIME_INVALID', 'Pickup time must include a timezone');
    pickedUpAt = new Date(pickup.pickedUpAt);
    if (!Number.isFinite(pickedUpAt.getTime()) || pickedUpAt > now)
      invalid(
        'PICKUP_TIME_INVALID',
        'Pickup time cannot be invalid or in the future',
      );
  }
  return { ...profile, pickedUpAt };
}

export function pickupStatusAfterRecording(status: DeliveryStatus) {
  return status === DeliveryStatus.AwaitingPickup
    ? DeliveryStatus.PickedUp
    : status;
}
