import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { StaffApprovalStatus, UserType } from '@prisma/client';

export const STAFF_TYPES: UserType[] = [
  UserType.InternationalDriver,
  UserType.ParcelCourier,
];

export function canManageStaff(user: {
  type: UserType;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) {
  return user.isSuperAdmin || user.isAdmin || user.type === UserType.Manager;
}

// Used by every authentication path, including direct Supabase bearer tokens.
export function assertAccountAccess(user: {
  type: UserType;
  staffApprovalStatus?: StaffApprovalStatus;
  isBlocked?: boolean;
  isDeleted?: boolean;
  business?: { isActive: boolean };
  driverProfile?: { id: number; isDeleted: boolean } | null;
  courierProfile?: { id: number; isDeleted: boolean } | null;
}) {
  if (user.isDeleted || user.isBlocked || user.business?.isActive === false) {
    throw new UnauthorizedException('Account is unavailable');
  }
  if (user.staffApprovalStatus === StaffApprovalStatus.Pending) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'STAFF_APPROVAL_PENDING',
      message: 'Акаунт очікує підтвердження адміністратора.',
    });
  }
  const profile =
    user.type === UserType.InternationalDriver
      ? user.driverProfile
      : user.type === UserType.ParcelCourier
        ? user.courierProfile
        : undefined;
  if (STAFF_TYPES.includes(user.type) && (!profile || profile.isDeleted)) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'STAFF_PROFILE_MISSING',
      message:
        'Профіль перевізника не налаштовано. Зверніться до адміністратора.',
    });
  }
}
